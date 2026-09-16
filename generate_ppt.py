import collections.abc
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
import os

def create_presentation():
    prs = Presentation()
    # Set slide dimensions to widescreen 16:9
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Color Palette Definition (Dark Premium Theme)
    BG_COLOR = RGBColor(26, 26, 26)       # Dark Charcoal
    TEXT_COLOR = RGBColor(240, 240, 240)  # Off-white
    PRIMARY_COLOR = RGBColor(63, 81, 181) # Indigo Blue
    ACCENT_COLOR = RGBColor(76, 175, 80)  # Green Nudge
    SUB_TEXT_COLOR = RGBColor(170, 170, 170)

    def set_slide_background(slide):
        background = slide.background
        fill = background.fill
        fill.solid()
        fill.fore_color.rgb = BG_COLOR

    def add_title(slide, text):
        title_box = slide.shapes.add_textbox(Inches(0.75), Inches(0.5), Inches(11.833), Inches(1.0))
        tf = title_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = text
        p.font.size = Pt(36)
        p.font.bold = True
        p.font.color.rgb = TEXT_COLOR
        p.font.name = "Segoe UI"
        return title_box

    # --- SLIDE 1: Title Slide ---
    slide_layout = prs.slide_layouts[6] # Blank layout
    slide1 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide1)
    
    # Large Title Box
    title_box = slide1.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(11.333), Inches(3.5))
    tf = title_box.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = "Mnemosync"
    p.font.size = Pt(72)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_COLOR
    p.alignment = PP_ALIGN.CENTER
    p.font.name = "Segoe UI"

    p2 = tf.add_paragraph()
    p2.text = "Recall • Reconnect • Reclaim"
    p2.font.size = Pt(28)
    p2.font.color.rgb = TEXT_COLOR
    p2.alignment = PP_ALIGN.CENTER
    p2.font.name = "Segoe UI"
    
    p3 = tf.add_paragraph()
    p3.text = "\nAn AI-Powered Companion for Alzheimer's & Dementia Care"
    p3.font.size = Pt(18)
    p3.font.color.rgb = SUB_TEXT_COLOR
    p3.alignment = PP_ALIGN.CENTER
    p3.font.name = "Segoe UI"

    # --- SLIDE 2: Problem Statement ---
    slide2 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide2)
    add_title(slide2, "Problem Statement")

    body_box = slide2.shapes.add_textbox(Inches(0.75), Inches(1.8), Inches(11.833), Inches(5.0))
    tf = body_box.text_frame
    tf.word_wrap = True

    p = tf.paragraphs[0]
    p.text = "Dementia & Alzheimer's strip away independence through three core daily struggles:"
    p.font.size = Pt(20)
    p.font.color.rgb = TEXT_COLOR
    p.font.name = "Segoe UI"

    points = [
        ("Face Blindness (Prosopagnosia):", " Inability to recognize familiar faces—even family and close friends—leading to extreme social anxiety, isolation, and depression."),
        ("Conversation & Context Loss:", " Forgetting the context of a conversation minutes after it occurs, causing repetitive questioning and mounting frustration."),
        ("Routine & Promise Deterioration:", " Failure to remember short-term commitments (e.g., 'I will bring you water') or crucial daily routines (e.g., taking medication), transferring a massive coordination burden to human caregivers.")
    ]

    for title, desc in points:
        p_item = tf.add_paragraph()
        p_item.space_before = Pt(20)
        run_title = p_item.add_run()
        run_title.text = "• " + title
        run_title.font.bold = True
        run_title.font.size = Pt(18)
        run_title.font.color.rgb = PRIMARY_COLOR
        run_title.font.name = "Segoe UI"
        
        run_desc = p_item.add_run()
        run_desc.text = desc
        run_desc.font.size = Pt(18)
        run_desc.font.color.rgb = SUB_TEXT_COLOR
        run_desc.font.name = "Segoe UI"

    # --- SLIDE 3: Proposed Solution ---
    slide3 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide3)
    add_title(slide3, "Proposed Solution")

    body_box = slide3.shapes.add_textbox(Inches(0.75), Inches(1.8), Inches(11.833), Inches(5.0))
    tf = body_box.text_frame
    tf.word_wrap = True

    p = tf.paragraphs[0]
    p.text = "Mnemosync functions as an ambient, non-intrusive 'second brain' for the user:"
    p.font.size = Pt(20)
    p.font.color.rgb = TEXT_COLOR
    p.font.name = "Segoe UI"

    sol_points = [
        ("Ambient Vision Context:", " Silently recognizes faces and delivers real-time on-screen reminders of the person's identity and social history."),
        ("Intelligent Transcript Synthesis:", " Captures and summarizes local audio into concise 'Memory Nuggets' to maintain context."),
        ("Automated Task Extraction:", " Parses conversation transcripts to identify promised tasks and updates the local 'Memory Dashboard' automatically."),
        ("Resilient Offline Architecture:", " Utilizes a multi-tier fallback model (Gemini 3 -> Gemini 2.5 -> local browser models) so the user is never left without assistance during network dropouts.")
    ]

    for title, desc in sol_points:
        p_item = tf.add_paragraph()
        p_item.space_before = Pt(14)
        run_title = p_item.add_run()
        run_title.text = "• " + title
        run_title.font.bold = True
        run_title.font.size = Pt(18)
        run_title.font.color.rgb = ACCENT_COLOR
        run_title.font.name = "Segoe UI"
        
        run_desc = p_item.add_run()
        run_desc.text = desc
        run_desc.font.size = Pt(18)
        run_desc.font.color.rgb = SUB_TEXT_COLOR
        run_desc.font.name = "Segoe UI"

    # --- SLIDE 4: Technology Stack ---
    slide4 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide4)
    add_title(slide4, "Technology Stack")

    body_box = slide4.shapes.add_textbox(Inches(0.75), Inches(1.8), Inches(11.833), Inches(5.0))
    tf = body_box.text_frame
    tf.word_wrap = True

    tech_stack = [
        ("Frontend & Routing:", " React 19, TypeScript, Vite"),
        ("Styling & Animations:", " Modern CSS (Premium dark mode glassmorphism) & Framer Motion"),
        ("Primary Model:", " Google Gemini 3 Flash (High-speed, multi-modal contextual reasoning)"),
        ("Secondary Backup:", " Google Gemini 2.5 Flash (API rate-limit & quota failover protection)"),
        ("Local Computer Vision:", " React Webcam & Face-API.js (Local, offline facial identification)"),
        ("Offline Storage (Privacy):", " IndexedDB (idb) for locally secured, client-side data persistence")
    ]

    for title, desc in tech_stack:
        p_item = tf.add_paragraph()
        p_item.space_before = Pt(16)
        run_title = p_item.add_run()
        run_title.text = "• " + title
        run_title.font.bold = True
        run_title.font.size = Pt(18)
        run_title.font.color.rgb = PRIMARY_COLOR
        run_title.font.name = "Segoe UI"
        
        run_desc = p_item.add_run()
        run_desc.text = desc
        run_desc.font.size = Pt(18)
        run_desc.font.color.rgb = SUB_TEXT_COLOR
        run_desc.font.name = "Segoe UI"

    # --- SLIDE 5: Supporting Diagram - Workflow ---
    slide5 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide5)
    add_title(slide5, "System Workflow Architecture")
    
    # Draw native vector diagram shapes directly on Slide 5
    from pptx.enum.shapes import MSO_SHAPE
    
    # Card styles
    CARD_BG = RGBColor(38, 42, 51)
    CYAN_BORDER = RGBColor(3, 169, 244)
    PURPLE_BORDER = RGBColor(156, 39, 176)
    GREEN_BORDER = RGBColor(76, 175, 80)
    ARROW_COLOR = RGBColor(120, 120, 120)
    
    def draw_card(slide, text, x_in, y_in, w_in, h_in, border_color, shape_type=MSO_SHAPE.ROUNDED_RECTANGLE):
        shape = slide.shapes.add_shape(shape_type, Inches(x_in), Inches(y_in), Inches(w_in), Inches(h_in))
        shape.fill.solid()
        shape.fill.fore_color.rgb = CARD_BG
        shape.line.color.rgb = border_color
        shape.line.width = Pt(2)
        tf = shape.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = text
        p.font.size = Pt(13)
        p.font.name = "Segoe UI"
        p.font.bold = True
        p.font.color.rgb = TEXT_COLOR
        p.alignment = PP_ALIGN.CENTER
        return shape

    def draw_arrow(slide, x_in, y_in, w_in, h_in, direction="right"):
        shape_type = MSO_SHAPE.RIGHT_ARROW if direction == "right" else MSO_SHAPE.DOWN_ARROW
        shape = slide.shapes.add_shape(shape_type, Inches(x_in), Inches(y_in), Inches(w_in), Inches(h_in))
        shape.fill.solid()
        shape.fill.fore_color.rgb = ARROW_COLOR
        shape.line.fill.background()
        return shape

    # Section Headers / Titles
    def add_section_header(slide, text, x_in, y_in, w_in):
        tb = slide.shapes.add_textbox(Inches(x_in), Inches(y_in), Inches(w_in), Inches(0.5))
        p = tb.text_frame.paragraphs[0]
        p.text = text
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = ACCENT_COLOR
        p.font.name = "Segoe UI"
        p.alignment = PP_ALIGN.CENTER

    # Column 1: Sensory Input (React Frontend)
    add_section_header(slide5, "1. Sensory Input", 0.75, 1.4, 2.8)
    draw_card(slide5, "📷 Webcam Feed\n(Real-time face frames)", 0.75, 2.0, 2.8, 1.3, CYAN_BORDER)
    draw_card(slide5, "🎤 Speech Input\n(Web Speech API STT)", 0.75, 4.3, 2.8, 1.3, CYAN_BORDER)
    
    # Input to AI Orchestrator connector
    draw_arrow(slide5, 3.75, 3.6, 0.7, 0.4, "right")

    # Column 2: Hybrid AI Routing & Fallback
    add_section_header(slide5, "2. Hybrid AI Fail-Safe", 4.65, 1.4, 3.7)
    draw_card(slide5, "Primary: Gemini 3 Flash\n- High Context Face ID\n- Conversational Synthesis", 4.65, 2.0, 3.7, 1.0, PURPLE_BORDER)
    draw_arrow(slide5, 6.3, 3.1, 0.4, 0.3, "down")
    draw_card(slide5, "Backup: Gemini 2.5 Flash\n- Rate-limit Protection\n- Fallback Event Parsing", 4.65, 3.5, 3.7, 1.0, PURPLE_BORDER)
    draw_arrow(slide5, 6.3, 4.6, 0.4, 0.3, "down")
    draw_card(slide5, "Local Models & Heuristics\n- face-api.js Recognition\n- Regex Task Extraction", 4.65, 5.0, 3.7, 1.0, PURPLE_BORDER)

    # AI to Storage connector
    draw_arrow(slide5, 8.55, 3.6, 0.7, 0.4, "right")

    # Column 3: Storage & Presentation
    add_section_header(slide5, "3. Privacy DB & Dashboard", 9.45, 1.4, 3.1)
    draw_card(slide5, "IndexedDB (Local Storage)\n- Zero Cloud Face DB\n- Reminders & Task Logs", 9.45, 2.0, 3.1, 1.3, GREEN_BORDER, MSO_SHAPE.CAN)
    draw_arrow(slide5, 10.8, 3.5, 0.4, 0.6, "down")
    draw_card(slide5, "React Dashboard UI\n- Visual Memory Logs\n- Proactive Audio Alerts\n- Live Social Nudges", 9.45, 4.3, 3.1, 1.8, GREEN_BORDER)

    # --- SLIDE 6: System Workflow Infographic ---
    slide6 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide6)
    add_title(slide6, "System Workflow Infographic")
    
    infographic_path = os.path.join("public", "mnemosync_workflow_infographic.jpg")
    if os.path.exists(infographic_path):
        slide6.shapes.add_picture(infographic_path, Inches(1.0), Inches(1.5), Inches(11.333), Inches(5.2))
    else:
        tb = slide6.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(11.333), Inches(3.0))
        tb.text_frame.text = "[High-Fidelity Workflow Infographic Image Not Found. Paste image here.]"

    # --- SLIDE 7: Conceptual Design / Mockup ---
    slide7 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide7)
    add_title(slide7, "Concept Design & Visual Interface")
    
    mockup_path = r"C:\Users\DELL\.gemini\antigravity\brain\6449ae18-97c6-4f36-838a-aa0f2d6fef19\mnemosync_concept_art_1781719529453.png"
    if os.path.exists(mockup_path):
        slide7.shapes.add_picture(mockup_path, Inches(1.0), Inches(1.5), Inches(11.333), Inches(5.2))
    else:
        tb = slide7.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(11.333), Inches(3.0))
        tb.text_frame.text = "[Concept Art Mockup Image Not Found at default path. Paste mockup image here.]"

    # --- SLIDE 8: Expected Impact ---
    slide8 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide8)
    add_title(slide8, "Expected Impact")

    body_box = slide8.shapes.add_textbox(Inches(0.75), Inches(1.8), Inches(11.833), Inches(5.0))
    tf = body_box.text_frame
    tf.word_wrap = True

    impacts = [
        ("Restores Autonomy:", " Empowers patients to complete daily tasks and engage with loved ones independently."),
        ("Relieves Caregiver Burnout:", " Automatically tracks commitments, reducing the need for constant monitoring."),
        ("Scalable & Accessible:", " Fully software-based, allowing run-time performance on standard tablets and laptops without specialized clinical hardware."),
        ("Privacy-First Approach:", " Zero-cloud data processing for identified faces ensures medical compliance and absolute personal privacy.")
    ]

    for title, desc in impacts:
        p_item = tf.add_paragraph()
        p_item.space_before = Pt(20)
        run_title = p_item.add_run()
        run_title.text = "• " + title
        run_title.font.bold = True
        run_title.font.size = Pt(18)
        run_title.font.color.rgb = ACCENT_COLOR
        run_title.font.name = "Segoe UI"
        
        run_desc = p_item.add_run()
        run_desc.text = desc
        run_desc.font.size = Pt(18)
        run_desc.font.color.rgb = SUB_TEXT_COLOR
        run_desc.font.name = "Segoe UI"

    # --- SLIDE 9: Project Roadmap ---
    slide9 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide9)
    add_title(slide9, "Project Roadmap")

    body_box = slide9.shapes.add_textbox(Inches(0.75), Inches(1.8), Inches(11.833), Inches(5.0))
    tf = body_box.text_frame
    tf.word_wrap = True

    roadmap = [
        ("Phase 1: Hackathon Prototype (Completed)", " Full web prototype, multi-tier AI routing logic, IndexedDB schema structure, and working vision pipeline."),
        ("Phase 2: Mobile Port & Wearable R&D (Months 1-6)", " Packaging the app via React Native and exploring integration with smart glasses (e.g., heads-up-display interfaces)."),
        ("Phase 3: Caregiver Portal & Clinical Testing (Months 6-12)", " Constructing a secure remote view portal for caretakers and executing pilot studies in memory facilities."),
        ("Phase 4: Smart Home Integration (Year 2+)", " Connecting Mnemosync to smart home systems to trigger visual alerts on TVs or smart speakers based on task logs.")
    ]

    for title, desc in roadmap:
        p_item = tf.add_paragraph()
        p_item.space_before = Pt(16)
        run_title = p_item.add_run()
        run_title.text = "• " + title
        run_title.font.bold = True
        run_title.font.size = Pt(18)
        run_title.font.color.rgb = PRIMARY_COLOR
        run_title.font.name = "Segoe UI"
        
        run_desc = p_item.add_run()
        run_desc.text = desc
        run_desc.font.size = Pt(18)
        run_desc.font.color.rgb = SUB_TEXT_COLOR
        run_desc.font.name = "Segoe UI"

    # --- SLIDE 10: Team Details ---
    slide10 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide10)
    add_title(slide10, "Team Details")

    body_box = slide10.shapes.add_textbox(Inches(0.75), Inches(2.2), Inches(11.833), Inches(4.5))
    tf = body_box.text_frame
    tf.word_wrap = True

    p = tf.paragraphs[0]
    p.text = "Team Mnemosync"
    p.font.size = Pt(24)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_COLOR
    p.font.name = "Segoe UI"

    p_item = tf.add_paragraph()
    p_item.space_before = Pt(20)
    run_mem = p_item.add_run()
    run_mem.text = "• Jaswanth & Team\n"
    run_mem.font.bold = True
    run_mem.font.size = Pt(20)
    run_mem.font.color.rgb = TEXT_COLOR
    run_mem.font.name = "Segoe UI"
    
    run_role = p_item.add_run()
    run_role.text = "  Full-Stack & AI Engineers\n\n"
    run_role.font.size = Pt(18)
    run_role.font.color.rgb = SUB_TEXT_COLOR
    run_role.font.name = "Segoe UI"

    p_note = tf.add_paragraph()
    p_note.text = "(Note: You can open this file and edit these names/roles to match your team configuration before submitting!)"
    p_note.font.size = Pt(14)
    p_note.font.italic = True
    p_note.font.color.rgb = SUB_TEXT_COLOR
    p_note.font.name = "Segoe UI"

    output_filename = "Mnemosync_Submission.pptx"
    prs.save(output_filename)
    print(f"Presentation created successfully as {output_filename}!")

if __name__ == "__main__":
    create_presentation()
