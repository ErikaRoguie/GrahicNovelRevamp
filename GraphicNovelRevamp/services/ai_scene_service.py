import os
import json
from openai import OpenAI

# the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
# do not change this unless explicitly requested by the user
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
openai = OpenAI(api_key=OPENAI_API_KEY)

def suggest_scene_details(text):
    """
    Analyze text and suggest visual scene details for comic panel creation.
    Returns JSON with scene suggestions including mood, composition, and visual elements.
    """
    try:
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a comic scene visualization expert. Analyze the text and provide "
                        "detailed scene suggestions in comic panel format. Include visual elements, "
                        "mood, composition, and character positions. Format response as JSON."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Analyze this text and suggest how to visualize it in a comic panel:\n{text}"
                    )
                }
            ],
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error in scene suggestion: {e}")
        return {
            "error": str(e),
            "fallback_suggestion": {
                "composition": "default",
                "mood": "neutral",
                "visual_elements": ["basic panel layout"]
            }
        }

def enhance_panel_layout(scene_count):
    """
    Suggest optimal panel layout based on scene count and story flow.
    """
    try:
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a comic layout expert. Suggest the optimal panel layout "
                        "configuration for the given number of scenes. Consider storytelling "
                        "flow and visual impact. Respond in JSON format."
                    )
                },
                {
                    "role": "user",
                    "content": f"Suggest optimal panel layout for {scene_count} scenes"
                }
            ],
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error in layout suggestion: {e}")
        return {
            "layout": "2x2" if scene_count <= 4 else "3x2",
            "error": str(e)
        }
