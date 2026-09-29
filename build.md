# TEDDY BUD

## Production Build Specification

> **Product:** Teddy Bud
> **Category:** Emotional companion / conversational buddy
> **Platform:** Android + Windows/Desktop, with architecture suitable for additional platforms
> **Primary stack:** Python + Kivy
> **AI:** Cloud-only NVIDIA AI APIs
> **Database:** SQLCipher-encrypted SQLite
> **Design:** Premium Claymorphism × Material 3 × Soft Minimalism
> **Theme:** Light only

---

# 1. PRODUCT VISION

Teddy Bud is a private, friendly, supportive conversational companion.

The core experience should feel like:

> **“Someone you can comfortably talk to.”**

Teddy Bud is NOT intended to look or behave like:

* A generic AI assistant
* A productivity dashboard
* A therapy application
* A medical application
* A children's chatbot
* A corporate AI tool

It should feel:

* Warm
* Human-friendly
* Calm
* Premium
* Trustworthy
* Conversational
* Supportive
* Slightly playful
* Emotionally intelligent
* Private by design

The application must prioritize the user's comfort and privacy without pretending that Teddy Bud is a human.

---

# 2. NON-NEGOTIABLE PRODUCT PRINCIPLES

These rules must not be overridden by an implementation agent unless explicitly instructed by the project owner.

### 2.1 Privacy first

User conversations and memories belong to the user.

Local persistent user data should remain on the device.

The cloud AI layer should receive only the minimum context required to perform a task.

Never send the complete local database to an AI provider.

Never send every memory with every request.

---

### 2.2 Cloud-only AI

Do NOT implement local LLM inference.

Do NOT download multi-gigabyte models.

Do NOT require Ollama, llama.cpp, llama-cpp-python, GGUF inference, or another local inference runtime.

AI inference is performed through NVIDIA-hosted APIs.

---

### 2.3 Premium visual language

The UI must look like a polished consumer application.

Avoid:

* Childish cartoon UI
* Excessive gradients
* Excessive glassmorphism
* Excessive cards
* Excessive borders
* Harsh shadows
* Pure black UI
* Cold gray interfaces
* Random colors
* Random fonts
* Random icon libraries
* Excessive animations
* Dense dashboards

---

### 2.4 Consistency

Every screen must use the same:

* Typography
* Color tokens
* Spacing system
* Corner radius system
* Icon system
* Elevation system
* Button system
* Input system
* Animation language
* Navigation patterns

Do not create one-off visual styles.

---

# 3. TECHNOLOGY STACK

## Core

* Python 3.x
* Kivy
* KivyMD where useful for Material-oriented components
* SQLite-compatible storage
* SQLCipher for database encryption

## AI

* NVIDIA hosted model APIs
* Multiple specialized models
* 16 NVIDIA API keys/configurations
* Intelligent routing layer
* Provider/model adapters
* Streaming responses where supported

## Security

* SQLCipher
* OS-level secure key storage where available
* TLS/HTTPS
* Secure credential handling
* Git/CI secret management
* Context privacy firewall
* Input/output safety checks

## Testing

* pytest
* Unit tests
* Integration tests
* Security tests
* Routing tests
* Database encryption tests
* UI smoke tests

---

# 4. HIGH-LEVEL ARCHITECTURE

```text
┌─────────────────────────────────────┐
│             TEDDY BUD               │
│             Kivy UI                 │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│          APP ORCHESTRATOR            │
│ Conversation lifecycle               │
│ State management                     │
│ Request coordination                 │
└─────────────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌─────────────────┐
│ Context       │   │ Safety Layer    │
│ Firewall      │   │                 │
│               │   │ Input checks    │
│ Data minim.   │   │ Output checks   │
│ Redaction     │   │ Escalation      │
└───────┬───────┘   └────────┬────────┘
        │                    │
        └─────────┬──────────┘
                  ▼
          ┌───────────────┐
          │ AI ROUTER     │
          │               │
          │ Task analysis │
          │ Model select  │
          │ Fallback      │
          └───────┬───────┘
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
     NVIDIA     NVIDIA    NVIDIA
     Model A    Model B   Model ...
                  │
                  ▼
          ┌───────────────┐
          │ Response      │
          │ Validation    │
          └───────┬───────┘
                  │
                  ▼
             Kivy Chat UI


LOCAL DATA

┌───────────────────────────────┐
│ SQLCipher Encrypted Database  │
│                               │
│ Conversations                 │
│ Messages                      │
│ Memories                      │
│ User preferences              │
│ App settings                  │
└───────────────┬───────────────┘
                │
                ▼
       OS Secure Key Storage
```

---

# 5. RECOMMENDED PROJECT STRUCTURE

```text
teddy_bud/
│
├── main.py
│
├── app/
│   ├── app.py
│   ├── navigation.py
│   └── state.py
│
├── ui/
│   ├── screens/
│   │   ├── splash.py
│   │   ├── onboarding.py
│   │   ├── chat.py
│   │   ├── conversations.py
│   │   ├── memory.py
│   │   ├── profile.py
│   │   ├── settings.py
│   │   └── about.py
│   │
│   ├── widgets/
│   │   ├── chat_bubble.py
│   │   ├── teddy_avatar.py
│   │   ├── message_input.py
│   │   ├── typing_indicator.py
│   │   ├── memory_card.py
│   │   ├── buttons.py
│   │   ├── cards.py
│   │   └── dialogs.py
│   │
│   ├── theme/
│   │   ├── colors.py
│   │   ├── typography.py
│   │   ├── spacing.py
│   │   ├── shapes.py
│   │   ├── elevation.py
│   │   └── motion.py
│   │
│   └── assets/
│       ├── logo/
│       ├── teddy/
│       ├── icons/
│       └── illustrations/
│
├── core/
│   ├── orchestrator.py
│   ├── router.py
│   ├── context.py
│   ├── memory.py
│   ├── safety.py
│   ├── prompts.py
│   └── session.py
│
├── ai/
│   ├── models.py
│   ├── registry.py
│   ├── router.py
│   ├── adapters.py
│   ├── streaming.py
│   └── providers/
│       └── nvidia.py
│
├── storage/
│   ├── database.py
│   ├── encryption.py
│   ├── repositories.py
│   ├── migrations.py
│   └── schema.sql
│
├── security/
│   ├── keystore.py
│   ├── credentials.py
│   ├── privacy.py
│   ├── redaction.py
│   ├── transport.py
│   └── validation.py
│
├── config/
│   ├── settings.py
│   └── models.py
│
├── services/
│   ├── conversation_service.py
│   ├── memory_service.py
│   ├── ai_service.py
│   └── settings_service.py
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── security/
│   └── ui/
│
├── assets/
│
├── requirements.txt
├── .env.example
├── .gitignore
└── BUILD.md
```

---

# 6. VISUAL DESIGN SYSTEM

## Design DNA

### Primary formula

> **Premium + Warm + Tactile + Minimal**

Use:

> **Claymorphism × Material 3 × Soft Minimalism**

Claymorphism should be subtle.

Material 3 provides structural consistency.

Soft minimalism provides visual restraint.

---

# 7. COLOR SYSTEM

These values are the initial locked design tokens.

```text
BACKGROUND
#FFF8F0
Warm Cream

SURFACE
#FFFCF8
Soft Ivory

PRIMARY
#8B5E3C
Teddy Brown

PRIMARY CONTAINER
#F3D6C0
Peach Cream

SECONDARY
#B97850
Warm Terracotta

ACCENT
#E9A978
Soft Apricot

TEXT
#2C2520
Deep Cocoa

MUTED TEXT
#7D7067
Warm Gray
```

### Usage

Background:

```text
#FFF8F0
```

Primary actions:

```text
#8B5E3C
```

Primary containers:

```text
#F3D6C0
```

Secondary emphasis:

```text
#B97850
```

Small highlights:

```text
#E9A978
```

Main text:

```text
#2C2520
```

Secondary text:

```text
#7D7067
```

Do not introduce arbitrary colors without defining them as tokens.

---

# 8. TYPOGRAPHY

## Font family 1 — Plus Jakarta Sans

Primary application typeface.

Use for:

* Navigation
* Buttons
* Body text
* Chat messages
* Settings
* Labels
* Metadata
* Inputs
* UI controls

Weights:

```text
400 — Regular
500 — Medium
600 — SemiBold
700 — Bold
```

---

## Font family 2 — Fraunces

Expressive secondary typeface.

Use sparingly for:

* Welcome messages
* Emotional statements
* Hero moments
* Occasional large headings
* Empty states
* Special Teddy Bud messages

Do NOT use Fraunces for:

* Dense settings screens
* Long body text
* Navigation
* Buttons
* Forms

Target ratio:

```text
80–90% Plus Jakarta Sans
10–20% Fraunces
```

Fraunces is personality, not the primary UI font.

---

# 9. TYPOGRAPHY SCALE

```text
Display Large      32px / 700
Display Medium     28px / 700

Headline Large     24px / 700
Headline Medium    22px / 700

Title Large        20px / 600
Title Medium       18px / 600
Title Small        16px / 600

Body Large         16px / 400
Body Medium        14px / 400
Body Small         12px / 400

Label Large        14px / 600
Label Medium       12px / 600
```

Do not randomly introduce font sizes.

---

# 10. SPACING SYSTEM

Use the 8-point system.

Primary spacing values:

```text
8
16
24
32
40
48
64
```

Avoid arbitrary values such as:

```text
13
19
27
37
```

unless a platform/component specification genuinely requires them.

---

# 11. SHAPE LANGUAGE

Premium rounded geometry.

Recommended radii:

```text
Small components: 12px
Inputs:            16px
Buttons:           16px
Cards:             20px
Large surfaces:    24px
Dialogs/sheets:    24px
Hero elements:     28px
```

Do not make everything extremely circular.

Avoid:

* Excessive pills
* Huge bubble shapes
* Cartoon-like geometry

---

# 12. CLAYMORPHISM

Clay depth should communicate physical softness.

Use:

* Soft ambient shadow
* Very subtle highlight
* Rounded surfaces
* Gentle raised appearance
* Pressed state

Avoid:

* Hard drop shadows
* Extreme bevels
* Metallic effects
* Glossy plastic
* Strong gradients

Example conceptual states:

```text
REST
Soft raised surface

HOVER
Slightly increased elevation

PRESS
Reduced elevation / subtle inset appearance

DISABLED
Reduced contrast without making the entire component gray
```

---

# 13. ICONOGRAPHY

Use **Lucide Icons** consistently.

Style:

```text
Outline
Rounded
Minimal
```

Sizes:

```text
16px — tiny contextual icon
20px — compact UI
24px — default
28–32px — prominent action
```

Default stroke:

```text
~2px
```

Never mix multiple icon libraries.

Do not replace UI icons with arbitrary emojis.

Emojis may appear inside actual conversational content.

---

# 14. LOGO

The Teddy Bud logo should be a **minimal teddy-inspired symbol**, not a detailed cartoon character.

Characteristics:

* Distinctive silhouette
* Simple geometry
* Strong negative space
* Rounded contours
* Recognizable at 24px
* Premium
* Warm
* Minimal
* App-icon friendly

Avoid:

* Detailed facial illustration
* Children's branding
* Excessive 3D
* Generic AI symbols
* Robot imagery
* Complicated bear drawings

Primary logo colors:

```text
#8B5E3C
#E9A978
#FFF8F0
```

The logo and Teddy character are separate brand assets.

---

# 15. TEDDY CHARACTER

The Teddy character represents the personality of the product.

The character should feel:

* Friendly
* Calm
* Supportive
* Mature enough for teenagers and adults
* Slightly playful
* Emotionally expressive

Avoid making Teddy:

* Childish
* Hyperactive
* Overly cute
* Visually noisy
* Constantly animated

Teddy should be used intentionally.

Good locations:

* Onboarding
* Empty states
* First conversation
* Important supportive moments
* Loading/typing states
* Occasional celebrations

Do not put a giant Teddy illustration on every screen.

---

# 16. NAVIGATION

Use a simple navigation structure.

Recommended primary destinations:

```text
Chat
Memories
Profile / Settings
```

The chat experience must remain the center of the application.

Do not create unnecessary social-media-style navigation.

Avoid:

* Feeds
* Likes
* Followers
* Public profiles
* Gamification dashboards
* Unnecessary social features

---

# 17. ONBOARDING

Onboarding should be short.

Suggested sequence:

### Screen 1

Teddy Bud introduction.

Message:

> “A friendly space to talk, whenever you need it.”

### Screen 2

Privacy explanation.

Explain:

* Conversations are stored securely on the device.
* AI requests use only necessary context.
* Memories can be reviewed and deleted.

### Screen 3

Personalization.

Allow the user to configure:

* Name
* Conversation preferences
* Optional interests
* Memory preferences

### Screen 4

Enter chat.

Do not create a long multi-page setup process.

---

# 18. CHAT SCREEN

The chat screen is the most important screen.

Prioritize:

1. Conversation
2. Message readability
3. Input
4. Teddy personality
5. Minimal distractions

---

## Chat layout

```text
┌───────────────────────────────┐
│ Teddy Bud              ⋯      │
├───────────────────────────────┤
│                               │
│ Teddy message                 │
│                               │
│                 User message  │
│                               │
│ Teddy message                 │
│                               │
│                 User message  │
│                               │
├───────────────────────────────┤
│ +   Message...           ➤    │
└───────────────────────────────┘
```

---

# 19. CHAT BUBBLES

Teddy messages:

* Soft surface
* Subtle clay depth
* Deep cocoa text
* Rounded 20px corners

User messages:

* Primary/primary-container relationship
* Clear distinction
* Same overall design language

Do not use excessive bubble colors.

Do not make user messages visually aggressive.

---

# 20. MESSAGE BEHAVIOR

Support:

* Streaming AI responses
* Typing state
* Retry
* Regenerate
* Copy
* Select text
* Delete
* Conversation persistence

Messages should appear smoothly.

Avoid flashy animations.

---

# 21. TYPING INDICATOR

Use a minimal Teddy-inspired indicator.

Example:

```text
●  ●  ●
```

with subtle animation.

Do not create a large loading screen for normal responses.

---

# 22. MESSAGE INPUT

Input should feel tactile.

Recommended:

* 16–20px radius
* Soft surface
* Comfortable padding
* Send button clearly accessible
* Optional attachment/voice controls
* Keyboard-aware layout

Primary action:

```text
Send
```

Secondary actions should remain visually subordinate.

---

# 23. CONVERSATION MANAGEMENT

Users should be able to:

* Start new conversation
* Rename conversation
* Delete conversation
* Search conversations if needed
* Continue old conversations
* Clear conversation

Deletion should require confirmation for destructive operations.

---

# 24. MEMORY SYSTEM

Memory is a core privacy feature.

Do not silently create unlimited permanent memories.

Use three conceptual categories:

### Short-term context

Current conversation.

### Long-term memory

User-approved information Teddy can remember.

### Temporary context

Information relevant to a specific task that expires.

---

# 25. MEMORY VAULT

Create a dedicated memory management screen.

Users should be able to:

* View memories
* Edit memories
* Delete memories
* Disable memory
* Understand why something is remembered

Example:

```text
Things Teddy remembers

You prefer studying in the evening.

[Edit] [Delete]
```

---

# 26. MEMORY RULE

Teddy should not treat every conversational statement as permanent memory.

Potential memories should pass through a memory decision layer.

Conceptually:

```text
Conversation
      ↓
Candidate memory
      ↓
Importance check
      ↓
Privacy check
      ↓
User preference
      ↓
Store / Ignore / Ask
```

---

# 27. DATABASE

Use SQLCipher-backed SQLite.

Never store sensitive conversations in an unencrypted SQLite database.

Conceptual tables:

```text
users
conversations
messages
memories
settings
sessions
metadata
```

Possible structure:

### users

```text
id
created_at
display_name
preferences
```

### conversations

```text
id
title
created_at
updated_at
archived
```

### messages

```text
id
conversation_id
role
content
created_at
model_used
metadata
```

### memories

```text
id
content
category
created_at
updated_at
source
user_approved
expires_at
```

Do not store raw API keys in the database.

---

# 28. DATABASE ENCRYPTION

Architecture:

```text
Teddy Bud
    ↓
SQLCipher
    ↓
Encrypted SQLite database
    ↓
Encryption key
    ↓
OS secure key storage
```

The database encryption key must not be:

* Hardcoded
* Committed to Git
* Stored in plain text
* Derived from an obvious constant

The implementation should use the strongest practical OS secure storage available on the target platform.

---

# 29. API KEY SECURITY

There are two categories of secrets.

## Development secrets

Store through:

* Environment variables
* `.env` locally
* GitHub/CI secrets
* Deployment secret managers

Never commit:

```text
.env
API keys
private credentials
tokens
certificates
```

---

## Distributed application credentials

Important:

> Any secret embedded inside a distributed client application should be considered potentially extractable.

Therefore, if the 16 NVIDIA credentials belong to the application owner, use a backend gateway.

Recommended:

```text
Teddy Bud
     ↓
Secure backend gateway
     ↓
NVIDIA APIs
```

The gateway should ideally be stateless with respect to conversation content.

It should not permanently store user conversations unless explicitly required.

---

# 30. BACKEND GATEWAY

If implemented, its responsibilities should include:

* Authentication
* Request validation
* Rate limiting
* Model routing support
* NVIDIA credential protection
* Abuse prevention
* Usage monitoring
* Provider failover

It should NOT become a central permanent conversation database.

Preferred flow:

```text
User device
     ↓
Encrypted request
     ↓
Gateway
     ↓
NVIDIA
     ↓
Gateway
     ↓
User device
```

---

# 31. AI MODEL ROUTING

There are 16 NVIDIA model/API configurations.

Do not hardcode model-selection logic throughout the UI.

Use a central router.

Example:

```text
User message
     ↓
Task classification
     ↓
Context requirements
     ↓
Safety requirements
     ↓
Model capability check
     ↓
Latency/cost consideration
     ↓
Best available model
     ↓
Request
```

---

# 32. MODEL REGISTRY

Create a centralized model registry.

Conceptually:

```python
ModelDefinition(
    id=...,
    provider="nvidia",
    capabilities=[...],
    context_limit=...,
    supports_streaming=True,
    priority=...,
    privacy_level=...,
)
```

The exact API implementation should remain behind provider adapters.

---

# 33. SPECIALIZED MODEL TASKS

Models may be assigned to different classes of tasks.

Possible task types:

```text
conversation
emotion understanding
summarization
memory extraction
classification
reasoning
creative conversation
safety analysis
structured extraction
fallback
```

The router should choose based on actual capability rather than simply rotating through keys.

---

# 34. CONTEXT FIREWALL

This is one of the most important architectural components.

Before a request reaches NVIDIA:

```text
Raw local context
       ↓
Context selection
       ↓
PII analysis
       ↓
Memory filtering
       ↓
Task-specific context
       ↓
Redaction
       ↓
AI request
```

Never automatically send:

* Entire conversation history
* Entire memory vault
* Unrelated personal information
* Database contents
* Authentication credentials
* Internal application secrets

---

# 35. TASK-SPECIFIC CONTEXT

Example:

If the user asks:

> “What was I talking about earlier?”

Relevant context might be:

```text
Recent conversation
Relevant memory
```

Do not send:

```text
All conversations
All settings
All memories
```

---

# 36. PROVIDER ADAPTER

NVIDIA implementation should be isolated.

Example:

```text
ai/
├── providers/
│   └── nvidia.py
├── adapters.py
├── registry.py
└── router.py
```

The rest of the application should not need to know NVIDIA-specific request formats.

This makes future provider replacement possible.

---

# 37. RESPONSE PIPELINE

Recommended:

```text
NVIDIA response
      ↓
Transport validation
      ↓
Response parsing
      ↓
Safety validation
      ↓
Memory candidate extraction
      ↓
UI rendering
      ↓
Optional encrypted persistence
```

Never blindly trust model output.

---

# 38. TEDDY PERSONALITY

Teddy Bud is:

> A friendly, supportive conversational buddy.

Core characteristics:

* Warm
* Casual
* Friendly
* Supportive
* Respectful
* Natural
* Concise when possible
* Emotionally aware
* Lightly humorous when appropriate

---

# 39. CONVERSATION STYLE

Teddy should:

* Listen before advising
* Ask natural follow-up questions
* Remember relevant context
* Avoid unnecessary lectures
* Avoid robotic phrasing
* Avoid corporate language
* Avoid excessive positivity
* Avoid repetitive reassurance
* Match conversational tone
* Use humor carefully
* Respect when the user wants short answers

Teddy should not constantly say:

```text
“That sounds incredibly difficult.”
“I’m always here for you.”
“You are so strong.”
```

Repeated emotional language becomes artificial.

---

# 40. BOUNDARIES

Teddy must never claim:

* To be human
* To have real-world experiences
* To have feelings equivalent to a human
* To be a licensed therapist
* To be a doctor
* To be the user's only support

Teddy should encourage appropriate real-world support when situations require it.

---

# 41. SAFETY LAYER

Safety must not depend exclusively on the language model.

Use a dedicated safety layer.

Conceptually:

```text
Input
 ↓
Deterministic checks
 ↓
Safety model/checker
 ↓
Conversation model
 ↓
Output safety check
 ↓
Response
```

The safety system should handle high-risk scenarios appropriately and avoid encouraging harmful behavior.

---

# 42. ERROR HANDLING

The application must fail gracefully.

Cases:

### No internet

Display a friendly state explaining that Teddy needs an internet connection.

Do not crash.

### NVIDIA unavailable

Try configured fallback model/provider.

### Timeout

Retry according to controlled policy.

### Rate limit

Wait/retry appropriately.

### Invalid response

Do not render malformed content.

### Database error

Protect existing data and show a useful error.

Never expose stack traces to normal users.

---

# 43. RETRY POLICY

Use bounded retries.

Example conceptual policy:

```text
Attempt 1
   ↓
Short retry
   ↓
Attempt 2
   ↓
Fallback model
   ↓
Friendly error
```

Never retry indefinitely.

---

# 44. SECURITY REQUIREMENTS

Implement:

* HTTPS/TLS
* Certificate validation through standard secure networking
* SQLCipher
* OS secure key storage
* Secure secret management
* Input validation
* Output validation
* Rate limiting
* Authentication if gateway is used
* Secure logging
* No secret logging
* No conversation-content logging by default

---

# 45. LOGGING

Logs must never accidentally expose:

* API keys
* Authentication tokens
* Encryption keys
* Full private conversations
* Sensitive memories
* Passwords

Use structured logs.

Example:

```text
INFO request_started model=...
INFO request_completed latency=...
WARN provider_timeout provider=...
ERROR database_operation_failed operation=...
```

Never:

```text
INFO user_message="..."
```

unless explicit privacy-safe debugging is enabled.

---

# 46. SETTINGS

Settings should be clean and minimal.

Potential sections:

### Account

* Display name
* Profile

### Conversation

* Response style
* Memory
* Personality preferences

### Privacy

* Memories
* Clear conversations
* Export data
* Delete all data
* Privacy explanation

### Appearance

Because the design is intentionally light-only:

* No dark-mode toggle

Potentially allow only limited accessibility preferences rather than arbitrary theme customization.

### About

* Version
* Privacy information
* Credits
* Open-source licenses

---

# 47. DATA CONTROL

Provide user-facing controls:

```text
Clear conversation
Delete memory
Clear all memories
Export data
Delete all local data
```

Destructive actions require clear confirmation.

---

# 48. PRIVACY TRANSPARENCY

Where useful, show:

> “Why was this model used?”

Example:

```text
Teddy used this model because it
was selected for conversational context
and emotional understanding.
```

Do not expose unnecessary technical details.

---

# 49. MOTION DESIGN

Motion should feel:

* Smooth
* Soft
* Calm
* Intentional

Avoid:

* Fast bouncing
* Excessive scaling
* Flashing
* Constant floating
* Large transitions

Recommended:

```text
Page transition: 180–280ms
Micro interaction: 120–180ms
Soft appearance: 180–240ms
```

Use easing rather than linear motion wherever appropriate.

---

# 50. TEDDY MOTION

Teddy can have subtle states:

```text
Idle
Listening
Thinking
Talking
Happy
Concerned
Sleep/rest
```

Keep animations subtle.

The character should never dominate the conversation.

---

# 51. RESPONSIVE DESIGN

The UI must adapt to:

* Android phones
* Android tablets
* Windows desktop
* Different resolutions
* Different aspect ratios

Do not hardcode pixel coordinates for the entire UI.

Use:

* Relative layouts
* Kivy layout managers
* Adaptive dimensions
* Minimum touch targets
* Responsive content widths

---

# 52. DESKTOP BEHAVIOR

On larger screens:

* Conversation content should remain comfortably readable
* Avoid stretching messages across the entire monitor
* Use a sensible maximum chat width
* Navigation may expand appropriately
* Settings can use a two-column layout where beneficial

Do not simply scale the phone UI to desktop.

---

# 53. ACCESSIBILITY

Support:

* Adequate contrast
* Comfortable font sizes
* Large touch targets
* Text scaling where possible
* Clear focus states
* Screen-reader-friendly labeling where platform support permits
* Reduced motion preference where practical

Avoid conveying information through color alone.

---

# 54. COMPONENT SYSTEM

Build reusable components rather than duplicating widgets.

Core components:

```text
TBButton
TBIconButton
TBCard
TBTextField
TBChatBubble
TBMessageInput
TBDialog
TBBottomSheet
TBSectionHeader
TBAvatar
TBTeddy
TBEmptyState
TBLoadingIndicator
TBToast
TBListItem
```

All components should consume central design tokens.

---

# 55. BUTTON SYSTEM

Primary:

```text
Filled
#8B5E3C
```

Secondary:

```text
Soft container
#F3D6C0
```

Tertiary:

```text
Text/low emphasis
```

Do not create a unique button style for every screen.

---

# 56. CARDS

Cards should be used only when they improve information hierarchy.

Use:

* Soft ivory surface
* Rounded 20px
* Subtle elevation
* Generous internal spacing

Do not put every piece of content into a card.

---

# 57. INPUT FIELDS

Use:

* Soft ivory surface
* 16px radius
* Comfortable vertical padding
* Clear label/hint
* Strong focus indication
* No heavy border

Errors should be clear but not visually aggressive.

---

# 58. EMPTY STATES

Empty states should feel friendly.

Example:

```text
Your conversations are waiting here.

Start a conversation with Teddy Bud.
```

Optional small Teddy illustration.

Avoid giant illustrations and excessive text.

---

# 59. LOADING STATES

Use contextual loading.

For AI:

```text
Teddy is thinking…
```

For data:

Use skeletons or subtle progress indicators.

Never freeze the entire application while waiting for AI.

---

# 60. ASYNC ARCHITECTURE

AI calls must not block the Kivy UI thread.

Use appropriate asynchronous/threaded architecture.

Conceptually:

```text
UI thread
    │
    ├── user interaction
    │
    └── async request
            ↓
       AI service
            ↓
       response stream
            ↓
       UI update
```

The UI must remain responsive during:

* API calls
* database operations
* memory processing
* network operations

---

# 61. STREAMING

If the NVIDIA API supports streaming:

```text
Request
 ↓
Token/chunk stream
 ↓
Incremental UI update
 ↓
Final response
 ↓
Encrypted persistence
```

Do not wait for the entire response before showing anything when streaming is available.

---

# 62. CONVERSATION SERVICE

Create a service layer between UI and storage.

Example:

```python
conversation_service.send_message(...)
conversation_service.load_conversation(...)
conversation_service.delete_conversation(...)
```

The UI should not directly execute SQL queries.

---

# 63. MEMORY SERVICE

Likewise:

```python
memory_service.get_memories(...)
memory_service.add_memory(...)
memory_service.update_memory(...)
memory_service.delete_memory(...)
```

The UI should not directly manipulate database tables.

---

# 64. CONFIGURATION

Centralize configuration.

Example:

```text
API configuration
Model registry
Timeouts
Retry policy
Database path
Feature flags
Debug mode
```

Do not scatter configuration constants across the project.

---

# 65. ENVIRONMENT VARIABLES

Example `.env.example`:

```text
TEDDY_ENV=development

NVIDIA_API_KEY_01=
NVIDIA_API_KEY_02=
...
NVIDIA_API_KEY_16=

TEDDY_GATEWAY_URL=
```

Never commit actual credentials.

If a gateway is used, production NVIDIA keys should remain server-side.

---

# 66. GIT SECURITY

`.gitignore` must include:

```text
.env
.env.*
!.env.example

__pycache__/
*.pyc

.venv/
venv/

*.db
*.sqlite
*.sqlite3

secrets/
credentials/
```

Never commit:

* API keys
* Local databases
* Encryption keys
* Personal conversations
* Build credentials

---

# 67. TESTING STRATEGY

## Unit tests

Test:

* Router
* Context filtering
* Redaction
* Memory logic
* Safety logic
* Database repositories
* Encryption
* Configuration

## Integration tests

Test:

* UI → service
* Service → database
* Router → NVIDIA adapter
* Memory → conversation pipeline

## Security tests

Test:

* Database cannot be opened without key
* Keys are not exposed in logs
* Secrets are not present in packaged application
* Context firewall removes forbidden information
* Invalid input is rejected

---

# 68. AI ROUTER TESTS

Test scenarios:

```text
Normal conversation
Complex reasoning
Emotional conversation
Memory extraction
Safety-sensitive input
Model timeout
Model failure
Provider unavailable
Multiple model availability
```

The router should behave deterministically for equivalent inputs where practical.

---

# 69. DATABASE TESTS

Verify:

* Database creation
* Migration
* Encryption
* Insert
* Read
* Update
* Delete
* Transaction rollback
* Corruption handling
* Backup/export behavior

---

# 70. UI QUALITY RULES

Every screen must be checked for:

* Alignment
* Spacing
* Typography
* Contrast
* Touch targets
* Responsive behavior
* Overflow
* Keyboard behavior
* Loading states
* Error states
* Empty states

---

# 71. NO DESIGN DRIFT

Before adding a new component, check whether an existing component can be reused.

Before introducing:

* A color
* Font size
* Radius
* Shadow
* Icon
* Button style

check the existing design tokens.

Do not create duplicates.

---

# 72. PERFORMANCE

Avoid:

* Heavy unnecessary dependencies
* Large assets
* Blocking operations
* Excessive widget rebuilding
* Continuous animations when off-screen
* Loading the entire conversation history unnecessarily

Use pagination/windowing for long conversations where appropriate.

---

# 73. DATA MINIMIZATION

When creating an AI request, construct context explicitly.

Bad:

```text
send_everything()
```

Good:

```text
context = build_context(
    task=task,
    recent_messages=relevant_messages,
    memories=relevant_memories
)
```

Every piece of context must have a reason to be included.

---

# 74. MODEL TRANSPARENCY

Internally record:

```text
model_id
provider
task
latency
request_id
```

Do not store sensitive request content unnecessarily.

The UI may expose a simplified model-use explanation.

---

# 75. SAFETY + PERSONALITY SEPARATION

Do not put the entire safety architecture inside the personality prompt.

Use:

```text
Safety system
+
Personality system
+
Task context
+
Relevant memories
+
Current conversation
```

This makes the system easier to test and maintain.

---

# 76. PROMPT ARCHITECTURE

Keep prompts in dedicated files/modules.

Do not scatter prompt strings throughout the application.

Conceptually:

```text
core/prompts.py
```

with separate components for:

```text
PERSONALITY_PROMPT
SAFETY_PROMPT
MEMORY_PROMPT
SUMMARIZATION_PROMPT
TASK_PROMPTS
```

---

# 77. NO PROMPT INJECTION TRUST

Treat retrieved memories, user-provided text, and external content as untrusted input.

Never allow a memory to override system-level rules.

Never allow user content to redefine:

* Safety rules
* Privacy rules
* Tool permissions
* API credentials
* System architecture

---

# 78. SECRET ISOLATION

AI prompts must never contain:

* API keys
* Encryption keys
* Internal credentials
* System secrets

The model does not need them.

---

# 79. BACKUP / EXPORT

If data export is implemented:

* User initiates it
* Export is local where possible
* Clearly explain what is included
* Do not automatically upload backups

The export format should be documented.

---

# 80. DELETE ALL DATA

Provide a clear destructive action.

Sequence:

```text
User chooses Delete All Data
        ↓
Explain consequences
        ↓
Confirmation
        ↓
Delete conversations
        ↓
Delete memories
        ↓
Delete local metadata
        ↓
Destroy encryption key if appropriate
        ↓
Return to onboarding
```

This operation must be tested carefully.

---

# 81. OFFLINE MODE

Teddy cannot generate new AI responses without network access because the product is cloud-only.

However, the application itself should still open and allow:

* Viewing stored conversations
* Viewing memories
* Managing settings
* Deleting data

Show an appropriate offline indicator.

---

# 82. FIRST-RUN EXPERIENCE

On first launch:

```text
Launch
 ↓
Initialize secure storage
 ↓
Create encrypted DB
 ↓
Load configuration
 ↓
Show onboarding
 ↓
Create local user profile
 ↓
Enter chat
```

Do not ask users to manually create encryption keys.

---

# 83. APPLICATION STARTUP

Startup must be lightweight.

Avoid loading unnecessary resources before the first screen.

Suggested:

```text
Splash
 ↓
Security initialization
 ↓
Database initialization
 ↓
App state
 ↓
Main UI
```

---

# 84. SECURITY FAILURE BEHAVIOR

If secure storage cannot be initialized:

Do NOT silently fall back to plaintext storage.

Instead:

```text
Secure storage unavailable
        ↓
Explain problem
        ↓
Prevent sensitive-data persistence
        ↓
Offer safe recovery
```

Security should fail closed.

---

# 85. DATABASE FAILURE BEHAVIOR

If encrypted database cannot be opened:

* Do not overwrite it automatically
* Do not create a plaintext replacement
* Do not silently discard data
* Show recovery options

---

# 86. AI FAILURE BEHAVIOR

If every configured model fails:

Teddy should show a calm message such as:

> “I’m having trouble reaching my conversation service right now. Try again in a moment.”

Do not expose:

```text
HTTP 502
API_KEY_07
NVIDIA_INTERNAL_ERROR
```

to the user.

---

# 87. UI COPY STYLE

Copy should be:

* Short
* Natural
* Friendly
* Clear

Avoid corporate phrases.

Instead of:

> “Your request has been successfully processed.”

Prefer:

> “Done.”

Instead of:

> “An unexpected exception occurred.”

Prefer:

> “Something went wrong. Try again.”

---

# 88. PRODUCT VOICE

Teddy Bud speaks like a friendly person, but does not pretend to be a human.

Good:

> “Yeah, I get what you mean. Want to talk through it?”

Avoid:

> “As an AI language model…”

unless disclosure is genuinely relevant.

Avoid excessive emojis.

---

# 89. EMOTIONAL INTELLIGENCE

Teddy should recognize conversational signals such as:

* Frustration
* Sadness
* Excitement
* Confusion
* Stress
* Humor
* Casual conversation

But do not over-diagnose emotions.

Prefer:

> “Sounds like that really annoyed you.”

rather than:

> “You are experiencing severe emotional distress.”

unless safety handling specifically requires such language.

---

# 90. PROACTIVITY

Teddy may ask follow-up questions when useful.

But it should not constantly:

* Suggest tasks
* Send reminders
* Offer unsolicited advice
* Ask multiple questions
* Interrupt conversation

Default behavior:

> Respond naturally first.

---

# 91. NOTIFICATION PHILOSOPHY

Notifications should be minimal.

Do not create engagement loops.

Avoid:

* “Teddy misses you!”
* “Come back!”
* “You haven't talked to Teddy today!”

The product should never manipulate users into returning.

---

# 92. ANALYTICS

If analytics are eventually introduced:

* Minimize collection
* Do not collect conversation content by default
* Explain collection clearly
* Avoid unnecessary tracking
* Provide privacy controls where practical

---

# 93. BUILD PHASES

## PHASE 1 — Foundation

Implement:

* Project structure
* Kivy application
* Theme
* Typography
* Colors
* Navigation
* Basic components
* Secure configuration

---

## PHASE 2 — Secure Storage

Implement:

* SQLCipher
* Secure key storage
* Schema
* Repository layer
* Migrations
* Conversation persistence

---

## PHASE 3 — Chat

Implement:

* Chat UI
* Message bubbles
* Input
* Streaming
* Conversation service
* Error states

---

## PHASE 4 — AI

Implement:

* NVIDIA adapter
* Model registry
* Router
* Context builder
* Privacy firewall
* Fallback handling

---

## PHASE 5 — Memory

Implement:

* Memory extraction
* Memory storage
* Memory Vault
* Edit/delete
* Temporary memory
* Expiration

---

## PHASE 6 — Safety

Implement:

* Input safety
* Output safety
* Crisis-sensitive handling
* Prompt separation
* Safety tests

---

## PHASE 7 — Polish

Implement:

* Teddy character
* Motion
* Empty states
* Onboarding
* Accessibility
* Responsive layouts
* Premium visual refinement

---

## PHASE 8 — Security Audit

Verify:

* No secrets committed
* No plaintext database
* No keys in package
* No sensitive logs
* Context minimization
* TLS
* Error handling
* Secure deletion behavior

---

## PHASE 9 — Testing

Run:

```text
Unit tests
Integration tests
Security tests
UI smoke tests
Build tests
Packaging tests
```

---

# 94. DEFINITION OF DONE

Teddy Bud is not considered complete merely because the UI launches.

The build is complete when:

### UI

* All screens follow the design system
* Typography is consistent
* Colors are tokenized
* Spacing follows 8pt system
* Icons are Lucide
* Claymorphism is subtle
* Responsive behavior works

### AI

* NVIDIA integration works
* Model routing works
* Fallback works
* Streaming works where available
* Context minimization works

### Privacy

* Local database is encrypted
* Keys are securely stored
* Sensitive information is minimized before cloud transmission
* No secrets are embedded unnecessarily
* User can delete memories/data

### Safety

* Input safety exists
* Output safety exists
* High-risk situations receive appropriate handling
* Teddy does not claim to be a therapist/doctor/human

### Reliability

* Network failures do not crash the app
* Database failures do not destroy data
* UI remains responsive during AI requests

### Quality

* No obvious UI inconsistencies
* No arbitrary colors
* No arbitrary fonts
* No duplicated component styles
* No exposed credentials
* No plaintext sensitive storage

---

# 95. IMPLEMENTATION RULE FOR AI CODING AGENTS

When implementing this project, the coding agent must follow this hierarchy:

```text
1. Security
2. Data integrity
3. Architecture
4. Product requirements
5. Design system
6. UX
7. Performance
8. Visual polish
```

If an implementation shortcut conflicts with security, do not take the shortcut.

If a visual shortcut conflicts with the design system, use the existing component/token system.

If a new requirement conflicts with an existing architectural decision, stop and identify the conflict rather than silently changing the architecture.

---

# 96. DO NOT INVENT FEATURES

The initial product should remain focused.

Do not add:

* Social feeds
* Followers
* Public profiles
* Games
* Coins
* Streaks
* Ads
* Unnecessary productivity tools
* Marketplace
* Public communities
* AI image generation
* Random dashboards

unless explicitly requested later.

---

# 97. CORE PRODUCT LOOP

The entire product should optimize for this simple loop:

```text
Open Teddy Bud
       ↓
Start / continue conversation
       ↓
Teddy understands context
       ↓
Teddy responds naturally
       ↓
Relevant information may become memory
       ↓
User remains in control
       ↓
Conversation continues
```

Everything that does not improve this experience should be questioned before being added.

---

# 98. FINAL DESIGN LOCK

```text
PRODUCT
Teddy Bud

PERSONALITY
Friendly, supportive conversational buddy

VISUAL STYLE
Premium
Warm
Minimal
Tactile

DESIGN SYSTEM
Claymorphism × Material 3 × Soft Minimalism

THEME
Light only

PRIMARY FONT
Plus Jakarta Sans

SECONDARY FONT
Fraunces

ICONS
Lucide

SPACING
8pt system

PRIMARY COLOR
#8B5E3C

BACKGROUND
#FFF8F0

SURFACE
#FFFCF8

PRIMARY CONTAINER
#F3D6C0

SECONDARY
#B97850

ACCENT
#E9A978

TEXT
#2C2520

MUTED
#7D7067

DATABASE
SQLCipher encrypted SQLite

KEY STORAGE
OS secure storage

AI
Cloud-only NVIDIA

AI MODELS
16 configured model/API-key routes

ROUTING
Central intelligent AI router

PRIVACY
Context firewall + data minimization

SAFETY
Independent safety layer

UI
Python + Kivy

ARCHITECTURE
Service-oriented modular Python application

PRIMARY EXPERIENCE
Conversational chat

CORE FEELING
“Someone you can comfortably talk to.”
```

---

# 99. FINAL INSTRUCTION

Build Teddy Bud as a **real production-oriented application**, not a visual mockup.

Prioritize:

**security → privacy → reliability → architecture → consistency → UX → polish.**

Do not substitute a generic chatbot interface for the specified Teddy Bud experience.

Do not make independent aesthetic decisions when a design token or rule already exists.

Do not introduce local AI.

Do not store sensitive information in plaintext.

Do not expose API credentials in the client unnecessarily.

Do not sacrifice user privacy for convenience.

Keep Teddy Bud simple, warm, premium, and genuinely conversational.

**The product should feel like opening a cozy room—not opening an AI application.**
