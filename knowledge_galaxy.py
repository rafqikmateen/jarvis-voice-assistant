import os
import re
import json
import math
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, HTTPServer
import threading

# ==========================================
# CONFIGURATION & CONSTANTS
# ==========================================
NOTES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notes")
CAPTURES_DIR = os.path.join(NOTES_DIR, "captures")
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWER_DIR = os.path.join(HERE, "frontend")   # graph-data.js is served by server.py under /static

# Map strict brand colors based on node/pipeline clusters
CLUSTER_COLORS = {
    "Financial Engines": "#00ffcc",  # Neon Teal/Green (Webull, Webull Crypto, IBKR)
    "Local Context": "#ff9900",     # Deep Amber/Orange (Cartagena Engine)
    "Voice AI Core": "#ff0066",     # Hot Pink (AI Self-Dialogue Oracle, Claude Code)
    "Workshop Notes": "#3399ff",    # Electric Blue (Markdown notes, Slide insights)
    "Captures": "#cc33ff",          # Vibrant Purple (Voice memories via "Remember that...")
    "System Subsystems": "#a0a0a0"  # Sleek Silver/Grey (Database Compactors, Storage Audit)
}

# Pre-seed 25 realistic sample notes about the AI Workshop and small business if folder is empty
SAMPLE_WORKSHOP_NOTES = {
    "YouTube_Channel_Strategy.md": """# YouTube Channel Strategy
Focus on high-engagement hooks and systematic content pillars. 
Cluster topics around AI automation, local development setups, and Jarvis integration. 
Every video should feature a clear hook-formula: problem identification, immediate visual proof, and a step-by-step installation blueprint. 
Target key terms such as Claude Code, Jarvis assistant development, and autonomous voice control. Maintain high visual pacing to match algorithmic recommendation systems.""",
    
    "Skool_Community_Infrastructure.md": """# Skool Community Infrastructure
The Free Skool Community serves as the foundational user funnel. 
Provide interactive plug-and-play code frameworks as immediate value props. 
Organize discussion spaces into logical categories: Daily Standups, Hardware Integration, and Prompt Pack Customization. 
Gamify milestone rewards to incentivize community contributions and active troubleshooting support among members.""",

    "Market_Research_Index.md": """# Market Research Index
Analyze high-velocity automation trends across modern small businesses. 
Identify major technical operational bottlenecks including disjointed CRM tracking, delayed manual data cross-referencing, and complex API integration overhead. 
Solutions leveraging local automated LLM execution pipelines significantly lower ongoing SaaS subscriptions and subscription dependencies.""",

    "Jarvis_Core_Skeleton.md": """# Jarvis Core Skeleton
The foundational runtime skeleton depends on an Iron-Man reactor HUD style interface pulsing in synchronization with outbound text-to-speech audio streams. 
Integrate cloned ElevenLabs voice synthesis with deep barge-in capabilities allowing real-time speech interruption. 
Maintain persistent context layers including live local environment scrapers and cross-platform notification pipelines.""",

    "Claude_Code_Pipelines.md": """# Claude Code Pipelines
Maximize file-system workflow efficiency by executing direct codebase modifications via terminal automation hooks. 
Isolate third-party libraries and leverage lightweight internal wrappers to lower latency bounds. 
Implement systematic validation steps including regex file sweeps, parallel network resource collection loops, and cache invalidation protocols."""
}

# Ensure all target environment directories exist safely
for folder in [NOTES_DIR, CAPTURES_DIR, VIEWER_DIR]:
    os.makedirs(folder, exist_ok=True)

PIPELINE_GROUPS = {
    "hub": "System Subsystems", "broker": "Financial Engines", "sports": "System Subsystems",
    "storage": "System Subsystems", "compactor": "System Subsystems", "digest": "Local Context",
    "oracle": "Voice AI Core", "netmap": "System Subsystems",
}


def load_pipeline_graph():
    """Reads GRAPH_DATA from server.py (parsed, not imported, so no server code runs)."""
    import ast
    with open(os.path.join(HERE, "server.py"), encoding="utf-8") as f:
        tree = ast.parse(f.read())
    for stmt in tree.body:
        if isinstance(stmt, ast.Assign) and any(getattr(t, "id", "") == "GRAPH_DATA" for t in stmt.targets):
            data = ast.literal_eval(stmt.value)
            break
    else:
        return [], []
    nodes = []
    for n in data["nodes"]:
        group = PIPELINE_GROUPS.get(n.get("type"), "System Subsystems")
        nodes.append({"id": n["id"], "label": n["label"], "type": n.get("type", "node"), "group": group, "color": CLUSTER_COLORS[group],
                      "excerpt": f"System pipeline node ({n.get('type', 'node')}).", "raw_text": "", "filename": ""})
    return nodes, [dict(l, value=2) for l in data["links"]]


# ==========================================
# 1. CORE GRAPH CORE ENGINE & FILE SCANNER
# ==========================================
def build_knowledge_galaxy():
    """Scans all markdown notes, extracts metadata, links cross-references, and exports a 3D Graph layout."""
    # Seed sample data if notes folder is completely vacant
    existing_md = [f for f in os.listdir(NOTES_DIR) if f.endswith('.md')]
    if not existing_md:
        for filename, content in SAMPLE_WORKSHOP_NOTES.items():
            with open(os.path.join(NOTES_DIR, filename), "w", encoding="utf-8") as f:
                f.write(content.strip())
        existing_md = [f for f in os.listdir(NOTES_DIR) if f.endswith('.md')]

    # Include captured voice memory notes
    if os.path.exists(CAPTURES_DIR):
        captured_md = [os.path.join("captures", f) for f in os.listdir(CAPTURES_DIR) if f.endswith('.md')]
        all_note_paths = existing_md + captured_md
    else:
        all_note_paths = existing_md

    nodes = []
    node_map = {}
    
    # Compile nodes array
    for index, rel_path in enumerate(all_note_paths):
        abs_path = os.path.join(NOTES_DIR, rel_path)
        filename = os.path.basename(rel_path)
        title = os.path.splitext(filename)[0].replace("_", " ")
        
        try:
            with open(abs_path, "r", encoding="utf-8") as f:
                text_content = f.read()
        except Exception:
            text_content = ""

        # Determine cluster group and strict brand colors
        if "captures" in rel_path.lower():
            group = "Captures"
        elif "strategy" in filename.lower() or "channel" in filename.lower():
            group = "YouTube Channel"
        elif "community" in filename.lower() or "skool" in filename.lower():
            group = "Skool Community"
        elif "research" in filename.lower() or "index" in filename.lower():
            group = "Market Research"
        else:
            group = "Workshop Notes"

        color = CLUSTER_COLORS.get(group, "#3399ff")
        
        # Clean clean text excerpt (~700 chars max)
        clean_excerpt = re.sub(r'[#\*`\[\]]', '', text_content)[:700].strip()
        
        node_entry = {
            "id": index,
            "label": title,
            "group": group,
            "color": color,
            "excerpt": clean_excerpt,
            "raw_text": text_content,
            "filename": filename
        }
        nodes.append(node_entry)
        node_map[title.lower()] = index

    # Build links using explicit wikilinks or direct title match references
    links = []
    for source_node in nodes:
        content_lower = source_node["raw_text"].lower()
        
        # Check title references to establish nodes connections
        for target_title, target_idx in node_map.items():
            if source_node["id"] == target_idx:
                continue
            
            # Match either [[wikilink]] syntax or direct title phrasing string inclusion
            wikilink_pattern = f"\\[\\[{target_title}\\]\\]"
            if re.search(wikilink_pattern, content_lower) or target_title in content_lower:
                links.append({
                    "source": source_node["id"],
                    "target": target_idx,
                    "value": 2
                })

    # Write out the static graph JavaScript definitions file
    graph_payload = {"nodes": nodes, "links": links}
    pipe_nodes, pipe_links = load_pipeline_graph()
    file_payload = {"nodes": pipe_nodes + nodes, "links": pipe_links + links}
    js_output_path = os.path.join(VIEWER_DIR, "graph-data.js")
    with open(js_output_path, "w", encoding="utf-8") as f:
        f.write(f"const GRAPH = {json.dumps(file_payload, indent=2)};")
    
    return graph_payload

# ==========================================
# 2. KEYWORD OVERLAP SCORING & CHAT ENGINE
# ==========================================
def search_notes_brain(query_string):
    """Scores notes via keyword overlap, selects the top 6 nodes, and mocks the structural response payload."""
    graph = build_knowledge_galaxy()
    query_words = [w.lower() for w in re.findall(r'\w+', query_string) if len(w) > 2]
    
    scored_nodes = []
    for node in graph["nodes"]:
        score = 0
        title_lower = node["label"].lower()
        text_lower = node["raw_text"].lower()
        
        for word in query_words:
            if word in title_lower:
                score += 15  # Title match amplification weight
            if word in text_lower:
                score += text_lower.count(word)
                
        if score > 0:
            scored_nodes.append((score, node))
            
    # Sort and slice out top 6 source nodes
    scored_nodes.sort(key=lambda x: x[0], reverse=True)
    top_matches = [node for score, node in scored_nodes[:6]]
    
    source_indexes = [node["id"] for node in top_matches]
    
    # Structural response synthesis
    if top_matches:
        primary_source = top_matches[0]["label"]
        mock_answer = f"Based on your notes regarding '{primary_source}', the workshop blueprint explicitly prioritizes optimizing content pillars and automation layouts. Full structural context is highlighted on screen."
    else:
        mock_answer = "I searched across all active knowledge galaxy clusters but couldn't locate specific note coverage matching that query."

    return {
        "answer": mock_answer,
        "nodes": source_indexes
    }

# ==========================================
# 3. ON-THE-FLY VOICE CAPTURES ("Remember that...")
# ==========================================
def remember_voice_insight(raw_input_text):
    """Parses a voice capture instruction, writes a persistent markdown file, and refreshes the galaxy structure live."""
    clean_text = re.sub(r'^remember\s+that\s+', '', raw_input_text, flags=re.IGNORECASE).strip()
    words = re.findall(r'\w+', clean_text)
    
    # Establish title from the first few words
    title_slug = "_".join(words[:4]) if len(words) >= 4 else "Voice_Capture"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"capture_{title_slug}_{timestamp}.md"
    
    filepath = os.path.join(CAPTURES_DIR, filename)
    markdown_content = f"# Captured Note: {clean_text[:30]}...\n\n- Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n- Context: Generated via voice transmission.\n\n{clean_text}"
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(markdown_content)


if __name__ == "__main__":
    g = build_knowledge_galaxy()
    print(f"Wrote {os.path.join(VIEWER_DIR, 'graph-data.js')}: {len(g['nodes'])} notes, {len(g['links'])} note links")
