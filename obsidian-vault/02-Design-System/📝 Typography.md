# 📝 Typography

← Back to [[🎨 Design System Hub]]

## Two-Voice System

### Switzer
**Role**: Universal body and UI face  
**Usage**: Paragraphs, buttons, nav, links, tags, helper text, small display

#### Specifications
- **Weights**: 400, 500, 540, 600, 700
- **Sizes**: 10, 11, 12, 14, 16, 18, 20, 24, 36px
- **Line height**: 1.00–1.50
- **Letter spacing**: 
  - 0.025em at small sizes
  - 0.14em for ALL-CAPS eyebrow labels
- **OpenType**: `"liga" 0`

#### Substitutes
- Inter
- Manrope  
- General Sans

---

### Basier Circle
**Role**: Headline and hero voice ONLY  
**Usage**: Reserved for largest statements (31px+), key brand moments

#### Specifications
- **Weights**: 500, 600
- **Sizes**: 16, 18, 20, 31, 39, 44, 49, 76px
- **Line height**: 1.00–1.20
- **Letter spacing**: 
  - -0.056em (-4.25px) at 76px
  - -0.013em at 16px
  - Dramatic negative tracking pulls characters tight

#### Substitutes
- Plus Jakarta Sans
- General Sans
- Satoshi

---

## Type Scale

| Role | Size | Line Height | Letter Spacing | Font |
|------|------|-------------|----------------|------|
| **caption** | 10px | 1.5 | 1.4px | Switzer |
| **body** | 16px | 1.5 | — | Switzer |
| **body-lg** | 18px | 1.45 | — | Switzer |
| **subheading** | 20px | 1.43 | -0.26px | Switzer |
| **heading-sm** | 31px | 1.1 | -0.4px | Basier Circle |
| **heading** | 44px | 1.08 | -1.15px | Basier Circle |
| **heading-lg** | 49px | 1.04 | -1.96px | Basier Circle |
| **display** | 76px | 1 | -4.25px | Basier Circle |

## Implementation

### Tailwind Config

```js
fontFamily: {
  switzer: ['Switzer', 'Inter', 'system-ui', 'sans-serif'],
  basier: ['Basier Circle', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
},
fontSize: {
  'caption': ['10px', { lineHeight: '1.5', letterSpacing: '1.4px' }],
  'body': ['16px', { lineHeight: '1.5' }],
  'body-lg': ['18px', { lineHeight: '1.45' }],
  'subheading': ['20px', { lineHeight: '1.43', letterSpacing: '-0.26px' }],
  'heading-sm': ['31px', { lineHeight: '1.1', letterSpacing: '-0.4px' }],
  'heading': ['44px', { lineHeight: '1.08', letterSpacing: '-1.15px' }],
  'heading-lg': ['49px', { lineHeight: '1.04', letterSpacing: '-1.96px' }],
  'display': ['76px', { lineHeight: '1', letterSpacing: '-4.25px' }],
}
```

## Rules

### ✅ Do
- Use Switzer for 10-24px
- Use Basier Circle for 31px+
- Pull headline tracking tight (-4.25px at 76px)
- Set body type at 16-18px with 1.45-1.5 line-height

### ❌ Don't
- Mix Switzer and Basier Circle at same size
- Set body text in rainbow gradient
- Use geometric sans fallback for Basier's negative tracking
- Center-align body paragraphs longer than 3 lines

---

**Tags**: #design #typography #fonts #type-scale
