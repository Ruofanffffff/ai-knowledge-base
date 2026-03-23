import re

file_path = "/Users/ruofanfeng/Documents/trae_projects/Note-taking app frontend（V2.0）/src/app/pages/SiChain.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace mainTab state
content = re.sub(
    r"  const noteTabEnabled = readFeatureFlag\('ff_sichain_note_tab_enabled', true\);\n  const unifiedDefault = readFeatureFlag\('ff_sichain_unified_doc_default', true\);\n\n  const \[mainTab, setMainTab\] = useState<'unified' \| 'doc' \| 'note'>\(\(\) => \{\n    if \(unifiedDefault\) return 'unified';\n    return noteTabEnabled \? 'note' : 'unified';\n  \}\);\n\n  useEffect\(\(\) => \{\n    if \(\!noteTabEnabled && mainTab === 'note'\) setMainTab\('unified'\);\n  \}, \[mainTab, noteTabEnabled\]\);",
    "  const [mainTab, setMainTab] = useState<'unified' | 'doc'>('unified');",
    content
)

# 2. Update Header Pill
content = re.sub(
    r"    if \(mainTab === 'unified'\) return unifiedGraph \? `\$\{unifiedGraph.entities.length\} 实体 · \$\{unifiedGraph.relations.length\} 关系` : 'Unified';\n    if \(mainTab === 'doc'\) return docGraph \? `\$\{docGraph.entities.length\} 实体 · \$\{docGraph.relations.length\} 关系` : 'Doc';\n    return `\$\{notes.length\} 篇 · \$\{allTags.length\} 标签`;",
    "    if (mainTab === 'unified') return unifiedGraph ? `${unifiedGraph.entities.length} 实体 · ${unifiedGraph.relations.length} 关系` : '全局图谱';\n    if (mainTab === 'doc') return docGraph ? `${docGraph.entities.length} 实体 · ${docGraph.relations.length} 关系` : '单篇视角';\n    return '';",
    content
)

# 3. Update Tab Buttons
content = re.sub(
    r"            \{\[\n              \{ key: 'unified', label: 'Unified' \},\n              \{ key: 'doc', label: 'Doc' \},\n              \.\.\.\(noteTabEnabled \? \[\{ key: 'note', label: 'Note' \}\] : \[\]\),\n            \]\.map\(t => \(\n              <button\n                key=\{t\.key\}\n                onClick=\{\(\) => \{\n                  setMainTab\(t\.key as any\);\n                  setUnifiedSelection\(null\);\n                  setDocSelection\(null\);\n                  setNoteSelectedNode\(null\);\n                \}\}",
    "            {[\n              { key: 'unified', label: '全局图谱' },\n              { key: 'doc', label: '单篇视角' },\n            ].map(t => (\n              <button\n                key={t.key}\n                onClick={() => {\n                  setMainTab(t.key as any);\n                  setUnifiedSelection(null);\n                  setDocSelection(null);\n                }}",
    content
)

# 4. Remove Note Tab rendering logic
note_start_str = "{mainTab === 'note' && ("
bottom_nav_str = "<BottomNav />"
if note_start_str in content and bottom_nav_str in content:
    start_idx = content.find(note_start_str)
    end_idx = content.find(bottom_nav_str, start_idx)
    if start_idx != -1 and end_idx != -1:
        # we want to delete from note_start_str to just before bottom_nav_str
        # the end_idx points to "<BottomNav />". We can just slice it out.
        # But wait, there might be a </div> right before <BottomNav /> that belongs to the parent!
        # The structure is:
        #   {mainTab === 'note' && ( <div>...</div> )}
        # </div>
        # <BottomNav />
        pass

# A safer way to remove Note tab rendering logic:
# we know it starts with `{mainTab === 'note' && (`
# we can just use regex or string replace if we know the exact block. Let's do a more robust brace matching.

def remove_note_block(text):
    start = text.find("{mainTab === 'note' && (")
    if start == -1: return text
    
    # find the matching closing brace for this block
    # It starts with '{' at `start`.
    count = 0
    end = -1
    for i in range(start, len(text)):
        if text[i] == '{':
            count += 1
        elif text[i] == '}':
            count -= 1
            if count == 0:
                end = i
                break
    
    if end != -1:
        # we also want to remove the leading spaces
        start_line = text.rfind('\n', 0, start)
        return text[:start_line] + text[end+1:]
    return text

content = remove_note_block(content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("done")
