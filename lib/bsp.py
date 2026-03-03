#!/usr/bin/env python3
"""
bsp.py — Block · Spindle · Point
Semantic address resolver for pscale JSON blocks.

Follows the kernel.js redesign (ring/spread modes).

Usage from command line:
    python lib/bsp.py wake                     # block mode
    python lib/bsp.py wake 0.12               # spindle mode
    python lib/bsp.py wake 0.12 -1            # point mode (pscale level)
    python lib/bsp.py wake 0.12 '*'           # ring mode (spindle + one-level children)
    python lib/bsp.py wake 0.12 '~'           # spread mode (raw subtree)
    python lib/bsp.py cooking 0.192 '*'       # concern architecture ring

Usage from Python:
    from bsp import bsp, bsp_register
    bsp_register(lambda name: json.load(open(f'blocks/{name}.json')))
    result = bsp('wake', 0.12, '*')
"""

import json
import sys
import os
import re

# ============ BLOCK NAVIGATION ============

def block_navigate(block, path):
    """Walk a dot-separated path through block['tree']."""
    if not path:
        return block.get('tree')
    node = block.get('tree')
    for k in path.split('.'):
        if node is None or isinstance(node, str):
            return None
        if isinstance(node, dict):
            node = node.get(k)
        else:
            return None
    return node


def x_spread(block, path):
    """Spread: node text + immediate children summaries."""
    node = block_navigate(block, path) if path else block.get('tree')
    if node is None:
        return None
    if isinstance(node, str):
        return {'text': node, 'children': []}
    text = node.get('_')
    children = []
    for k, v in node.items():
        if k == '_':
            continue
        if isinstance(v, str):
            child_text = v
        elif isinstance(v, dict) and '_' in v:
            child_text = v['_']
        else:
            child_text = None
        children.append({
            'digit': k,
            'text': child_text,
            'branch': isinstance(v, dict)
        })
    return {'text': text, 'children': children}


# ============ TUNING FORK ============

def get_tuning_decimal_position(blk):
    """Where pscale 0 sits, from the block's tuning field."""
    if not blk or 'tuning' not in blk:
        return None
    parts = str(blk['tuning']).split('.')
    int_str = parts[0] or '0'
    return 0 if int_str == '0' else len(int_str)


def get_compression_depth(tree):
    """How many '0' keys exist from tree root (compression layers)."""
    depth = 0
    node = tree
    while isinstance(node, dict) and '0' in node:
        depth += 1
        node = node['0']
    return depth


# ============ BSP — Block · Spindle · Point ============

_block_loader = None

def bsp_register(loader):
    """Register a function that resolves block names to block dicts."""
    global _block_loader
    _block_loader = loader


def bsp(block, spindle=None, point=None):
    """
    Block · Spindle · Point — semantic address resolution.

    bsp('wake')              → block mode (full tree)
    bsp('wake', 0.12)        → spindle mode (depth walk with pscale labels)
    bsp('wake', 0.12, -1)    → point mode (content at pscale level)
    bsp('wake', 0.12, '*')   → ring mode (spindle context + one-level children)
    bsp('wake', 0.12, '~')   → spread mode (raw subtree extraction)
    """
    # Resolve block name to object
    if isinstance(block, str):
        blk = _block_loader(block) if _block_loader else None
    else:
        blk = block

    if not blk or 'tree' not in blk:
        return {'mode': 'block', 'tree': {}}

    # Block mode — no spindle, no string point
    if spindle is None and not isinstance(point, str):
        return {'mode': 'block', 'tree': blk['tree']}

    # Parse the semantic number
    if spindle is None:
        walk_digits = []
        has_pscale = True
        digits_before = 0
    else:
        s = f'{spindle:.10f}' if isinstance(spindle, (int, float)) else str(spindle)
        parts = s.split('.')
        int_str = parts[0] or '0'
        frac_str = (parts[1] if len(parts) > 1 else '').rstrip('0')

        is_delineation = (int_str == '0')

        if is_delineation:
            walk_digits = [c for c in frac_str]
        else:
            walk_digits = list(int_str + frac_str)

        has_pscale = is_delineation or len(frac_str) > 0
        spindle_tree_depth = 0 if is_delineation else len(int_str)

        tuning_decimal = get_tuning_decimal_position(blk)
        if tuning_decimal is not None:
            digits_before = tuning_decimal
        elif is_delineation:
            digits_before = 0
        elif has_pscale:
            digits_before = len(int_str)
        else:
            digits_before = -1

        if tuning_decimal is not None:
            has_pscale = True

        # Tuning fork compensation
        if tuning_decimal is not None:
            needed = max(0, tuning_decimal - spindle_tree_depth)
            if needed > 0:
                max_comp = get_compression_depth(blk['tree'])
                zeros = min(needed, max_comp)
                if zeros > 0:
                    walk_digits = ['0'] * zeros + walk_digits

    # Build spindle — root always included
    nodes = []
    node = blk['tree']

    # Root text
    if isinstance(node, dict) and isinstance(node.get('_'), str):
        root_text = node['_']
        nodes.append({'pscale': digits_before if has_pscale else None, 'text': root_text})

    # Walk digits
    for i, d in enumerate(walk_digits):
        if not isinstance(node, dict) or d not in node:
            break
        node = node[d]
        if isinstance(node, str):
            text = node
        elif isinstance(node, dict) and isinstance(node.get('_'), str):
            text = node['_']
        else:
            text = json.dumps(node)
        nodes.append({
            'pscale': (digits_before - 1) - i if has_pscale else None,
            'digit': d,
            'text': text
        })

    if len(nodes) == 0:
        return {'mode': 'spindle', 'nodes': []}

    # Point mode
    if point is not None:
        # Coerce numeric strings
        if isinstance(point, str) and point not in ('~', '*'):
            try:
                point = int(point) if '.' not in point else float(point)
            except ValueError:
                pass

        if isinstance(point, str):
            end_path = '.'.join(walk_digits) if walk_digits else None

            if point == '*':
                # Ring: spindle context + one level of children at endpoint
                spread = x_spread(blk, end_path)
                children = spread['children'] if spread else []
                return {'mode': 'ring', 'nodes': nodes, 'children': children}

            if point == '~':
                # Spread: raw subtree extraction
                end_node = block_navigate(blk, end_path) if end_path else blk['tree']
                return {'mode': 'spread', 'path': end_path, 'subtree': end_node}

            return {'mode': 'error', 'error': f'Unknown point mode: {point}'}

        # Numeric point: find node at that pscale level
        target = next((n for n in nodes if n.get('pscale') == point), None)
        if target:
            return {'mode': 'point', 'text': target['text'], 'pscale': target['pscale']}
        last = nodes[-1]
        return {'mode': 'point', 'text': last['text'], 'pscale': last.get('pscale')}

    # Spindle mode — full chain
    return {'mode': 'spindle', 'nodes': nodes}


# ============ WRITE OPERATIONS ============

def block_write_node(block, path, content):
    """Write content to a path in a block. Creates intermediate nodes."""
    keys = path.split('.')
    last = keys[-1]
    node = block['tree']
    for k in keys[:-1]:
        if isinstance(node.get(k), str):
            node[k] = {'_': node[k]}
        if k not in node:
            node[k] = {}
        node = node[k]
    if isinstance(node.get(last), dict):
        node[last]['_'] = content
    else:
        node[last] = content
    return {'success': True}


def find_unoccupied_digit(block, path=None):
    """Find next free digit (1-9) at a path."""
    node = block_navigate(block, path) if path else block.get('tree')
    if not node or isinstance(node, str):
        return {'digit': '1', 'note': 'Node is leaf — will become branch'}
    for d in range(1, 10):
        if str(d) not in node:
            return {'digit': str(d)}
    return {'full': True, 'note': 'Digits 1-9 all occupied — compression needed'}


# ============ CLI ============

def format_spindle(result):
    """Format a spindle result for terminal output."""
    lines = []
    for n in result['nodes']:
        ps = n.get('pscale')
        ps_str = str(ps) if ps is not None else '?'
        indent = max(0, (ps if ps is not None else 0)) * 2
        # Truncate long text for readability
        text = n['text']
        if len(text) > 200:
            text = text[:200] + '...'
        lines.append(f"  [{ps_str:>3}] {text}")
    return '\n'.join(lines)


def format_ring(result):
    """Format a ring result for terminal output."""
    lines = []
    # Spindle context
    for n in result['nodes']:
        ps = n.get('pscale')
        ps_str = str(ps) if ps is not None else '?'
        text = n['text']
        if len(text) > 200:
            text = text[:200] + '...'
        lines.append(f"  [{ps_str:>3}] {text}")
    # Children
    if result.get('children'):
        lines.append('  ----')
        for c in result['children']:
            marker = ' +' if c.get('branch') else ''
            text = c.get('text') or '(branch)'
            if len(text) > 120:
                text = text[:120] + '...'
            lines.append(f"    {c['digit']}: {text}{marker}")
    return '\n'.join(lines)


def format_spread(result):
    """Format a spread result for terminal output."""
    return json.dumps(result.get('subtree'), indent=2, ensure_ascii=False)


def format_block(result):
    """Format a block result — just the tree keys at depth 1."""
    tree = result.get('tree', {})
    lines = []
    root = tree.get('_', '')
    if root:
        lines.append(f"  _: {root[:200]}{'...' if len(root) > 200 else ''}")
    for k, v in tree.items():
        if k == '_':
            continue
        if isinstance(v, str):
            text = v
        elif isinstance(v, dict):
            text = v.get('_', '(branch)')
        else:
            text = str(v)
        if len(text) > 120:
            text = text[:120] + '...'
        lines.append(f"  {k}: {text}")
    return '\n'.join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: python lib/bsp.py <block> [spindle] [point]")
        print("       python lib/bsp.py wake 0.12 '*'")
        sys.exit(1)

    # Find blocks directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    blocks_dir = os.path.join(repo_root, 'blocks')

    def loader(name):
        path = os.path.join(blocks_dir, f'{name}.json')
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f)
        return None

    bsp_register(loader)

    block_name = sys.argv[1]
    spindle = None
    point = None

    if len(sys.argv) > 2:
        spindle = float(sys.argv[2])

    if len(sys.argv) > 3:
        p = sys.argv[3]
        if p in ('*', '~'):
            point = p
        else:
            try:
                point = int(p) if '.' not in p else float(p)
            except ValueError:
                point = p

    result = bsp(block_name, spindle, point)
    mode = result.get('mode', '?')

    if mode == 'block':
        print(f"[{block_name}] block")
        print(format_block(result))
    elif mode == 'spindle':
        print(f"[{block_name} {spindle}] spindle")
        print(format_spindle(result))
    elif mode == 'point':
        ps = result.get('pscale', '?')
        print(f"[{block_name} {spindle} {point}] point [{ps}]")
        print(f"  {result['text']}")
    elif mode == 'ring':
        print(f"[{block_name} {spindle} *] ring")
        print(format_ring(result))
    elif mode == 'spread':
        print(f"[{block_name} {spindle} ~] spread @ {result.get('path')}")
        print(format_spread(result))
    elif mode == 'error':
        print(f"ERROR: {result.get('error')}")
    else:
        print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
