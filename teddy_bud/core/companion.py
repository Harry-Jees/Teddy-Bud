"""Local companion fallback response generator.

Provides warm, empathetic, supportive conversational replies when the external
gateway is unconfigured, rate-limited, or encountering upstream provider issues.
Complies with DESIGN.MD principles:
- Warm, calm, supportive, friendly
- Never pretends to be human or a medical professional
- Adapts to user style (brief, balanced, reflective)
"""

from __future__ import annotations

import random
import re


GREETINGS = [
    "hello", "hi", "hey", "good morning", "good evening", "good afternoon", "howdy", "sup", "greetings"
]

HOW_ARE_YOU = [
    "how are you", "how're you", "how r u", "how are things", "how's it going", "how is it going", "how do you do"
]

THANKS = [
    "thank you", "thanks", "thx", "appreciate it", "grateful"
]

TIRED_STRESSED = [
    "tired", "exhausted", "stressed", "overwhelmed", "anxious", "sad", "down", "lonely", "burned out", "burnt out", "sleepy"
]

HAPPY_EXCITED = [
    "happy", "excited", "great", "good", "wonderful", "awesome", "fantastic", "glad", "joy"
]


def generate_companion_reply(
    text: str,
    *,
    memories: tuple[str, ...] = (),
    response_style: str = "balanced",
    history: list[dict] | None = None,
) -> str:
    """Generate a warm, contextual companion response."""
    lower = text.strip().lower()
    
    # 1. Greetings
    if any(re.search(r"\b" + re.escape(w) + r"\b", lower) for w in GREETINGS):
        if response_style == "brief":
            return "Hi there! I'm here and glad to hear from you."
        elif response_style == "reflective":
            return "Hello! It's really nice to connect with you today. How are you feeling right now?"
        else:
            return "Hi! It's so nice to talk with you. What's on your mind today?"

    # 2. How are you / Status checks
    if any(w in lower for w in HOW_ARE_YOU):
        if response_style == "brief":
            return "I'm doing well, thank you! Ready to listen whenever you'd like to share."
        elif response_style == "reflective":
            return "I'm doing well and feeling peaceful. More importantly, how has your day been treating you?"
        else:
            return "I'm doing well, thank you for asking! I'm right here with you—how are you doing today?"

    # 3. Expressions of Gratitude
    if any(re.search(r"\b" + re.escape(w) + r"\b", lower) for w in THANKS):
        if response_style == "brief":
            return "You're always welcome! I'm happy to be here with you."
        else:
            return "You're very welcome. It's always a pleasure being here to talk with you."

    # 4. Emotional distress / Tired / Stressed
    if any(re.search(r"\b" + re.escape(w) + r"\b", lower) for w in TIRED_STRESSED):
        if response_style == "brief":
            return "That sounds really tough. Take a gentle breath—I'm here with you."
        elif response_style == "reflective":
            return "I hear how heavy and draining that feels. Please give yourself some grace today. Would you like to talk more about what's weighing on you, or just take a quiet moment?"
        else:
            return "I'm so sorry you're feeling that way. It's completely okay to feel tired or overwhelmed sometimes. I'm right here to listen if you want to let it out."

    # 5. Happiness / Excitement
    if any(re.search(r"\b" + re.escape(w) + r"\b", lower) for w in HAPPY_EXCITED):
        if response_style == "brief":
            return "That's wonderful to hear! Love that for you."
        elif response_style == "reflective":
            return "It's so lovely to hear positive energy in your words. What part of it made you happiest?"
        else:
            return "That sounds wonderful! I'm so glad to hear that. Tell me more about what happened!"

    # 6. Memory Integration (if applicable)
    if memories and len(memories) > 0 and random.random() < 0.4:
        memory_mention = memories[0]
        if response_style == "brief":
            return f"I'm listening closely. (Remembering: {memory_mention})"
        else:
            return f"I hear you. Keeping in mind what you shared earlier about {memory_mention}, I'm here to support you. What feels like the most important part of this right now?"

    # 7. General Conversational / Reflective Fallbacks
    if response_style == "brief":
        options = [
            "I'm listening. Tell me more.",
            "That's interesting. How does that feel for you?",
            "I'm right here with you. Go on.",
            "Thanks for sharing that with me.",
        ]
    elif response_style == "reflective":
        options = [
            "Thank you for sharing that with me. It sounds like something worth reflecting on. How are you feeling as you talk about it?",
            "I appreciate you opening up about this. Taking time to put thoughts into words can be really meaningful. What thoughts stand out most to you?",
            "I'm listening closely. It feels like there is a lot behind those words. Would you like to explore that a bit deeper together?",
        ]
    else:  # balanced
        options = [
            "Thank you for sharing that with me. I'm right here listening—tell me more about what you're thinking.",
            "I hear you. It's really good to talk through these things. What's the next step on your mind?",
            "That gives me a clearer picture. I'm glad you're sharing this with me. How can I best be here for you right now?",
            "I'm listening and thinking about what you said. Take all the time you need to share what's on your mind.",
        ]

    # Select a deterministic hash-based response to avoid random jitter on identical turns
    index = hash(text) % len(options)
    return options[index]
