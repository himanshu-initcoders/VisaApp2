# 📐 Layout & Spacing

← Back to [[🎨 Design System Hub]]

## Spacing System

**Base unit**: 4px  
**Density**: Comfortable

### Common Gaps
- **Page max-width**: 1200px
- **Section gap**: 80px
- **Card padding**: 16px
- **Element gap**: 16px

### Spacing Scale
```
4px   (1 unit)
8px   (2 units)
12px  (3 units)
16px  (4 units)
20px  (5 units)
24px  (6 units)
32px  (8 units)
40px  (10 units)
48px  (12 units)
64px  (16 units)
80px  (20 units)
```

---

## Border Radius

| Element | Radius | Purpose |
|---------|--------|---------|
| **Nav** | 28px | Floating pill navigation |
| **Buttons** | 28px | Slightly rounder than cards |
| **Cards** | 24px | Standard card container |
| **Images** | 24px | Photo cards, content tiles |
| **Inputs** | 16px | Form fields |
| **Tags** | 9999px | Full pill badges |

**Note**: Button/card differential (28px vs 24px) is intentional — buttons are rounder than surfaces they sit on.

---

## Elevation

### Floating Nav Bar
```css
box-shadow: 
  0 16px 16px -8px rgba(0,0,0,0.03),
  0 10px 10px -5px rgba(0,0,0,0.03),
  0 5px 5px -2.5px rgba(0,0,0,0.03),
  0 3px 3px -1.5px rgba(0,0,0,0.03),
  0 2px 2px -1px rgba(0,0,0,0.03),
  0 1px 1px -0.5px rgba(0,0,0,0.03);
```

### Profile Card
```css
box-shadow: 
  0 0 0 1px oklab(0 0 0 / 0.08),
  0 16px 16px -8px rgba(0,0,0,0.03),
  0 10px 10px -5px rgba(0,0,0,0.03),
  0 5px 5px -2.5px rgba(0,0,0,0.03),
  0 3px 3px -1.5px rgba(0,0,0,0.03),
  0 2px 2px -1px rgba(0,0,0,0.03),
  0 1px 1px -0.5px rgba(0,0,0,0.03);
```

### Elevated Card
```css
box-shadow: 
  0 0 0 1px oklab(0 0 0 / 0.06),
  0 20px 20px -10px rgba(0,0,0,0.07),
  0 10px 10px -5px rgba(0,0,0,0.04),
  0 5px 5px -2.5px rgba(0,0,0,0.03),
  0 3px 3px -1.5px rgba(0,0,0,0.03),
  0 2px 2px -1px rgba(0,0,0,0.03),
  0 1px 1px -0.5px rgba(0,0,0,0.03);
```

**Rules**:
- Max 8% black opacity
- Stack 3-6 thin layers with negative offsets
- Add 1px oklab hairline (4-10% opacity) instead of shadow when subtle separation needed

---

## Surfaces

| Surface | Color | Usage |
|---------|-------|-------|
| **Canvas** | #ffffff | Page background |
| **Card** | #ffffff | Content cards with 1px outline |
| **Sticky Nav** | #ffffff | Floating nav with shadow elevation |
| **Tinted Wash** | #e8f1ff | Highlighted areas, info chips |

---

## Layout Patterns

### Page Structure
- **Container**: Centered, max-width 1200px
- **Breathing room**: Generous padding
- **Section spacing**: 80px vertical gaps
- **No dividers**: Continuous white canvas

### Hero Section
**Stack** (centered):
1. Eyebrow text
2. 2-3 line display headline (rainbow-italicized word)
3. Subtext paragraph
4. Domain search input + embedded CTA
5. Login link

**Decoration**: Tilted photo cards scattered around edges

### Content Grid
- **Layout**: Masonry-like, 2-4 columns
- **Aspect ratios**: Varied (2:3 portrait, 16:9 horizontal)
- **Gap**: 16px between cards

### Navigation
- **Type**: Sticky floating pill
- **Position**: Centered, top
- **Elevation**: Soft drop shadow
- **No**: Sidebar, mega-menu, heavy footer

---

## Tailwind Config

```js
spacing: {
  '4': '4px',
  '8': '8px',
  '12': '12px',
  '16': '16px',
  '20': '20px',
  '24': '24px',
  '32': '32px',
  '40': '40px',
  '48': '48px',
  '64': '64px',
  '80': '80px',
},
borderRadius: {
  'nav': '28px',
  'button': '28px',
  'card': '24px',
  'image': '24px',
  'input': '16px',
  'tag': '9999px',
},
maxWidth: {
  'page': '1200px',
  'subtext': '520px',
},
```

---

**Tags**: #design #layout #spacing #elevation #grid
