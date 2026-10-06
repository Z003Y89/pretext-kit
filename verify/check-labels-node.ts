// The checker side of the label checker's oracle sweep, a process of its own (the stand-in and Pretext keep
// per-process state): `node verify/check-labels-node.ts <src dir> <input.json> <output.json>`. The first argument
// is src/, or a mutated copy of it for a mutant run; the checker runs from <src dir>/check/index.ts.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { CheckInput, Condition, Issue, Label, Platform, RowMap, Slot } from '../src/check/types.ts'

// One checkLabels call: the slots of one text scale, in that text scale's conditions. shrink: the shrinkTo labels,
// whose fitted size (no issue when it passes) is read from the checker's own evaluation. nearMiss: the margin the group
// runs with (the near-miss family); without it the report must hold no near-miss. explain: also record the checker's own
// evaluation of every label in the group (the sweep's diagnostic of check-mismatches; small groups only).
export type NodeGroup = { labels: Label[], slots: Record<string, Slot>, rows: RowMap, conditions: Condition[], shrink: string[], nearMiss?: number, explain?: boolean }
export type NodeInput = { fontPath: string, family: string, platform: Platform, groups: NodeGroup[] }
// verdicts[condition name][label key or row name]: the issue the report holds for it, absent when it passes; a near-miss
// goes to nearMiss[condition name][key] instead, its missing.px (the slack).
export type Verdict = {
  kind: Issue['kind'], fontPx: number, lines: number, width: number, box: number, stage?: number, detail?: string, missing?: Issue['missing'],
}
// explained[condition name][label key]: evaluateLabel's verdict, for a group with explain.
export type Explained = { kind: string, measured: Issue['measured'], missing?: Issue['missing'], slack?: number }
export type NodeOutput = {
  checked: number, verdicts: Record<string, Record<string, Verdict>>, fitted: Record<string, Record<string, number>>,
  nearMiss: Record<string, Record<string, number>>, explained?: Record<string, Record<string, Explained>>,
}

const [srcDir, inputPath, outputPath] = process.argv.slice(2)
if (srcDir === undefined || inputPath === undefined || outputPath === undefined) {
  throw new Error('usage: node verify/check-labels-node.ts <src dir> <input.json> <output.json>')
}
const input: NodeInput = JSON.parse(readFileSync(inputPath, 'utf8'))
const load = <T>(file: string): Promise<T> => import(pathToFileURL(join(srcDir, file)).href)
const check = await load<typeof import('../src/check/index.ts')>('check/index.ts')
const headless = await load<typeof import('../src/headless/index.ts')>('headless/index.ts')
const { resolveSlot } = await load<typeof import('../src/check/conditions.ts')>('check/conditions.ts')
const { evaluateLabel } = await load<typeof import('../src/check/evaluate.ts')>('check/evaluate.ts')
const { tabularFont } = await load<typeof import('../src/check/run.ts')>('check/run.ts')
const { clearCache } = await import('@chenglou/pretext')

const output: NodeOutput = { checked: 0, verdicts: {}, fitted: {}, nearMiss: {} }
for (const group of input.groups) {
  const checkInput: CheckInput = {
    fonts: [{ family: input.family, path: input.fontPath, weight: 400 }],
    labels: group.labels,
    slots: group.slots,
    rows: group.rows,
    conditions: group.conditions,
    platforms: [input.platform],
    ...(group.nearMiss === undefined ? {} : { nearMiss: group.nearMiss }),
  }
  const report = await check.checkLabels(checkInput)
  output.checked += report.checked
  for (const c of group.conditions) {
    output.verdicts[c.name] ??= {}
    output.nearMiss[c.name] ??= {}
  }
  for (const issue of [...report.failures, ...report.warnings, ...report.notes]) {
    if (issue.kind === 'near-miss') {
      if (group.nearMiss === undefined) throw new Error(`near-miss for ${issue.key} in ${issue.condition} with no nearMiss set`)
      const near = output.nearMiss[issue.condition]!
      if (near[issue.key] !== undefined) throw new Error(`two near-misses for ${issue.key} in ${issue.condition}`)
      near[issue.key] = issue.missing!.px!
      continue
    }
    const at = output.verdicts[issue.condition]!
    if (at[issue.key] !== undefined) throw new Error(`two issues for ${issue.key} in ${issue.condition}: ${at[issue.key]!.kind}, ${issue.kind}`)
    at[issue.key] = {
      kind: issue.kind, fontPx: issue.measured.fontPx, lines: issue.measured.lines, width: issue.measured.width, box: issue.measured.box,
      ...(issue.measured.stage === undefined ? {} : { stage: issue.measured.stage }),
      ...(issue.detail === undefined ? {} : { detail: issue.detail }),
      ...(issue.missing === undefined ? {} : { missing: issue.missing }),
    }
  }

  // The fitted size of every shrinkTo label: the checker's own evaluation of it, set up as checkLabels sets it up
  // (its fonts stay registered after it returns, its tabular twins named by the same rule).
  headless.install({ platform: input.platform, onMissingGlyph: 'throw', rounding: 'none' })
  clearCache()
  const byKey = new Map(group.labels.map(l => [l.key, l]))
  for (const condition of group.conditions) {
    const out: Record<string, number> = {}
    for (const key of group.shrink) {
      const label = byKey.get(key)!
      const slot = { ...group.slots[label.slot]! }
      if (slot.numeric === 'tabular') slot.font = tabularFont(slot.font, f => `${f} __tnum`)!
      out[key] = evaluateLabel(label.text, resolveSlot(label.slot, slot, condition), label.locale ?? 'und').measured.fontPx
    }
    output.fitted[condition.name] = { ...output.fitted[condition.name], ...out }
    if (group.explain !== true) continue
    const explained: Record<string, Explained> = {}
    for (const label of group.labels) {
      const slot = { ...group.slots[label.slot]! }
      if (slot.numeric === 'tabular') slot.font = tabularFont(slot.font, f => `${f} __tnum`)!
      const v = evaluateLabel(label.text, resolveSlot(label.slot, slot, condition), label.locale ?? 'und')
      explained[label.key] = {
        kind: v.kind, measured: v.measured,
        ...(v.missing === undefined ? {} : { missing: v.missing }), ...(v.slack === undefined ? {} : { slack: v.slack }),
      }
    }
    output.explained = { ...output.explained, [condition.name]: { ...output.explained?.[condition.name], ...explained } }
  }
}
writeFileSync(outputPath, JSON.stringify(output))
