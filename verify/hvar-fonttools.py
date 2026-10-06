# Reference side of `npm run verify:hvar` (verify/hvar-fonttools.ts runs this; run it by hand to look at the JSON).
#
# Needs fontTools 4.62.1 (pinned; the numbers in verify/HEADLESS_RESULTS.md were taken with it) and, for WOFF2
# files, brotli:   pip install fonttools==4.62.1 brotli
#
#   python3 verify/hvar-fonttools.py font.woff2 [more fonts] > out.json
#
# For each font with fvar and HVAR it picks axis locations (every axis at its min, default, max, three off-grid
# values, an integer grid of 17 points across the axis and 30 seeded random fractional values, one axis at a time
# with the others at default, plus 40 seeded random combinations of those across all axes, de-duplicated), normalizes each with fontTools (fvar, then avar version 1 where present, to F2Dot14), and evaluates
# every glyph's advance as hmtx + the HVAR delta through fontTools' VarStoreInstancer, unrounded.
import itertools, json, random, sys
from fontTools import version as ft_version
from fontTools.ttLib import TTFont
from fontTools.varLib.models import piecewiseLinearMap
from fontTools.varLib.varStore import VarStoreInstancer

PINNED = '4.62.1'


def normalize(axes, avar, design):
    coords = []
    for ax in axes:
        v = max(ax.minValue, min(ax.maxValue, design[ax.axisTag]))
        n = 0.0
        if v < ax.defaultValue:
            n = (v - ax.defaultValue) / (ax.defaultValue - ax.minValue)
        elif v > ax.defaultValue:
            n = (v - ax.defaultValue) / (ax.maxValue - ax.defaultValue)
        if avar is not None and ax.axisTag in avar.segments and avar.segments[ax.axisTag]:
            n = piecewiseLinearMap(n, avar.segments[ax.axisTag])
        coords.append(round(n * 16384))
    return coords


def locations(axes):
    rng = random.Random(20261006)
    picks = {}
    for ax in axes:
        lo, d, hi = ax.minValue, ax.defaultValue, ax.maxValue
        grid = {round(lo + (hi - lo) * k / 16) for k in range(17)}
        fractional = {round(rng.uniform(lo, hi), 3) for _ in range(30)}
        picks[ax.axisTag] = sorted({lo, d, hi, (lo + d) / 2 + 0.3, (d + hi) / 2 + 0.7, d + (hi - d) * 0.123} | grid | fractional)
    out = []
    default = {ax.axisTag: ax.defaultValue for ax in axes}
    for ax in axes:
        for v in picks[ax.axisTag]:
            out.append({**default, ax.axisTag: v})
    for _ in range(40):
        out.append({tag: rng.choice(vals) for tag, vals in picks.items()})
    seen, unique = set(), []
    for loc in out:
        key = tuple(sorted(loc.items()))
        if key not in seen:
            seen.add(key)
            unique.append(loc)
    return unique


def main(paths):
    result = {'fontTools': ft_version, 'fonts': {}}
    for path in paths:
        f = TTFont(path)
        if 'HVAR' not in f or 'fvar' not in f:
            result['fonts'][path] = {'skipped': 'no fvar or no HVAR'}
            continue
        avar = f['avar'] if 'avar' in f else None
        if avar is not None and getattr(avar, 'majorVersion', 1) != 1:
            result['fonts'][path] = {'skipped': 'avar version %s' % avar.majorVersion}
            continue
        axes = f['fvar'].axes
        hv = f['HVAR'].table
        order = f.getGlyphOrder()
        hm = f['hmtx'].metrics
        instances = []
        for design in locations(axes):
            coords = normalize(axes, avar, design)
            loc = {ax.axisTag: c / 16384 for ax, c in zip(axes, coords)}
            inst = VarStoreInstancer(hv.VarStore, axes, loc)
            adv = []
            for gi, g in enumerate(order):
                idx = hv.AdvWidthMap.mapping[g] if hv.AdvWidthMap is not None else gi
                adv.append(hm[g][0] + inst[idx])
            instances.append({'design': design, 'coords': coords, 'advances': adv})
        result['fonts'][path] = {
            'axes': [a.axisTag for a in axes],
            'avar': avar is not None,
            'advWidthMap': hv.AdvWidthMap is not None,
            'glyphs': len(order),
            'instances': instances,
        }
    json.dump(result, sys.stdout)


if __name__ == '__main__':
    main(sys.argv[1:])
