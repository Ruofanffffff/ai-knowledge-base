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

# 2. Update Headerimport re

file_path = "/Users/ruofanfeng/Documents
file_paed'
with open(file_path, r, encoding=utf-8) as f:
    content = f.read()

# 1. Replace mainTab ations.length\} 关系    content = f.read()

# 1. Replace mainTab sta
# 1. Replace mrn docGracontent = re.sub(
    r" ie    r"  const no?     "  const [mainTab, setMainTab] = useState<'unified' | 'doc'>('unified');",
    content
)

# 2. Update Headerimport re

file_path = "/Users/ruofanfeng/Documents
file_paed'
with open(file_path, r, encoding=utf-8) as f:
    content = f.read()

# 1. Replace mainTab ations.length\} 关系    content = f.read()

# 1. Replace mainTab sta
# 1. Replace mrn docGracontent = re.sub(
    r" ie    r"  const no?     "  const [mainTab, setMainTab] = useState<'unified' | 'doc'>('unified');",
    content
)

# 2. Update Headerimport re

f{     content
)

# 2. Update Headerimport re

file_path = "/Users/ruofanfeng/Documents
file_paed: '"Doc"' \},\n 
file_path = /Users/ruofaabEfile_paed
with open(file_path, "r", enco: with open    content = f.read()

# 1. Replace mainTab ati\n
# 1. Replace mainTab\n 
# 1. Replace mainTab sta
# 1. Replace mrn docGracontent = re. \{# 1. Replace mrn docGracoin    r" ie    r"  const no?     "  const      content
)

# 2. Update Headerimport re

file_path = "/Users/ruofanfeng/Documents
file_paed'
with open(file_path, r, enco  )

# 2. Up\},