# 🧩 Components Library

← Back to [[🎨 Design System Hub]]

## Navigation

### Floating Pill Nav
**Role**: Primary site navigation

**Specs**:
- White pill-shaped bar
- Border radius: 28px
- Height: ~56px
- Horizontal padding: 20px
- Shadow: 6-layer soft elevation (see [[📐 Layout & Spacing#Elevation|Elevation]])
- Floating centered above page

**Structure**:
1. Left: Portrait wordmark + tiny rainbow square icon
2. Center: [[#Announcement Pill]] - "New — Introducing Portrait Wallet"
3. Right: [[#Ghost Text Button]] (Login) + [[#Rainbow Outline CTA]] (Sign up)

---

## Buttons

### Rainbow Outline CTA
**Role**: Primary sign-up action

**Specs**:
- Pill button, 28px radius
- Transparent fill
- Border: 1.5px rainbow gradient (90deg)
- Text: Portrait Ink (#08304c), Switzer 500, 16px
- Padding: 16px × 10px

**Usage**: Most visible branded element - ONE per view maximum

### Ghost Text Button
**Role**: Secondary nav and inline action

**Specs**:
- No background, no border
- Text: Portrait Ink, Switzer 500, 14-16px
- Used for: Login, "Already have account?" links

---

## Cards

### Photo Profile Card
**Role**: User content tile (photo, link card, article preview)

**Specs**:
- Background: White
- Border radius: 24px
- Outline: 1px oklab at 4% opacity
- Shadow: Optional multi-layer soft elevation
- Padding: 16px on text areas

**Structure**:
- Image area with 24px top radius
- Title in Portrait Ink
- Meta line in Slate Helper (#797979)
- Optional external-link arrow

**Grid Behavior**: Masonry-like, varied aspect ratios (2:3 portrait, 16:9 horizontal)

### Article Snippet Card
**Role**: Linked blog or note preview

**Specs**:
- White card, 24px radius, 1px outline
- Compact horizontal layout
- Padding: 12-16px

**Structure**:
- Small square thumbnail
- Date (Slate Helper, 12px)
- Two-line headline (Portrait Ink, Switzer 500, 14-16px)
- "Read more" link with arrow

### Wallet Feature Card
**Role**: Product feature preview

**Specs**:
- Small horizontal card
- White background, 16-24px radius
- Subtle outline

**Structure**:
- Left: Wallet thumbnail
- Center: Title + [[#Eyebrow Label Pill]] ("New") + helper text
- Right: Arrow icon (Charcoal Outline)

---

## Inputs

### Domain Search Input
**Role**: URL claim field in hero

**Specs**:
- Large pill input, 9999px radius
- White fill, faint border
- Height: 60-64px
- Width: ~600px
- Contains: 
  - Light gray 'portrait.so/' prefix
  - Darker typed username
  - Nested [[#Rainbow Outline CTA]] inside

---

## Labels & Badges

### Eyebrow Label Pill
**Role**: Small status or category tag

**Specs**:
- Tiny pill, 9999px radius
- Backgrounds: [[🎨 Colors#Pastel Washes|Mint/Sky/Peach wash]]
- Text: Switzer 600, 10-11px, 0.14em tracking, UPPERCASE
- Padding: 3px × 8px

**Uses**: 'New', 'Early access', category labels

### Announcement Pill
**Role**: In-nav promotional badge

**Specs**:
- Sky-blue background (#e8f1ff)
- Padding: 6-8px × 12px
- Contains: 'New' label + announcement text + down-arrow icon

---

## Typography Components

### Display Headline Block
**Role**: Hero and section headlines

**Specs**:
- Font: Basier Circle 600, 44-76px
- Line-height: 1.0-1.08
- Letter-spacing: -4.25px (at 76px)
- Color: Portrait Ink
- **Special**: One italicized word filled with rainbow gradient

**Effect**: Compression makes block feel sculptural

### Hero Subtext
**Role**: Supporting paragraph below headline

**Specs**:
- Font: Switzer 400, 18px
- Line-height: 1.45
- Color: Portrait Ink or Graphite Body
- Layout: Centered, max-width 520px
- Spacing: 24-32px below headline

---

## Imagery

### Hero Photo Collage
**Role**: Scattered photo tiles around hero

**Specs**:
- 24px radius cards
- Tilted 3-6 degrees
- 1px hairline outline
- NO drop shadow (flat Polaroid effect)
- Partially overlap page edges

**Treatment**: Personal memorabilia style, natural color cast

---

## Home & listing heroes

Navy canvas `#062445`, destination photo, cream wave (`HeroWave`) into `#f8f6f1`. Listing heroes use Apply + Check Eligibility. Mobile is photo-first.

The **home page** does not use that full hero. It uses a compact search strip: Visas / Passport icon tabs, an Atlys-style India + Where to? pill, Airbnb-style category icons, then destination cards.

---

## Implementation Notes

All components use:
- [[🎨 Colors]] from design system
- [[📝 Typography]] scale
- [[📐 Layout & Spacing#Border Radius|Border radius]] standards
- [[📐 Layout & Spacing#Elevation|Elevation]] patterns

Related: [[⚙️ Technical Stack#Component Architecture|Component Architecture]]

---

**Tags**: #design #components #ui-library #reusable
