# 🎨 Colors - Portrait Palette

← Back to [[🎨 Design System Hub]]

## Primary Colors

### Portrait Ink
**Value**: `#08304c`  
**Usage**: Primary text, heading strokes, outlined action borders
> The single deep navy that holds the entire type and structural line system

### Nautical Teal
**Value**: `#084e72`  
**Usage**: Secondary brand ink for nav strokes, icons, accent text

### Rainbow Spectrum
**Value**: 
```css
linear-gradient(90deg, 
  rgb(38, 192, 255),     /* Cyan */
  rgb(230, 0, 194) 20%,  /* Magenta */
  rgb(255, 73, 78) 40%,  /* Red */
  rgb(255, 161, 62) 60%, /* Orange */
  rgb(255, 200, 55) 80%, /* Yellow */
  rgb(0, 204, 61)        /* Green */
)
```
**Usage**: 
- ✅ Sign up button border (1.5px)
- ✅ One italicized word per headline
- ✅ Small decorative accents
- ❌ NOT for primary CTA fill
- ❌ NOT for full-text gradient

## Neutrals

| Name | Hex | Usage |
|------|-----|-------|
| **Charcoal Outline** | `#353535` | Universal stroke, heavy text, hairline borders |
| **Graphite Body** | `#2c2c2c` | Body text on warm/pastel backgrounds |
| **Slate Helper** | `#797979` | Muted helper text, secondary nav |
| **Iron Quiet** | `#585858` | Quiet icon strokes, low-emphasis accents |
| **Ash Divider** | `#dedede` | Light dividers, structural hairlines |
| **Fog Edge** | `#c7c7c7` | Disabled borders, placeholder strokes |
| **Mist Hairline** | `#eeeeee` | Card tint, lightest divider |
| **White Canvas** | `#ffffff` | Page background, surface |

## Pastel Washes

| Name | Hex | Usage |
|------|-----|-------|
| **Mint Wash** | `#d7ffe2` | Badge chips, highlighted areas |
| **Sky Wash** | `#e8f1ff` | Section backgrounds, alternate surface |
| **Peach Wash** | `#ffebd6` | Warm-accent chips, highlights |

## Spectrum Colors (Gradient Only)

These colors appear ONLY as part of the rainbow gradient, never standalone:
- Lavender Violet: `#8e51ff`
- Cobalt Pop: `#3b82f6`
- Grape Vibrant: `#ad46ff`
- Cherry Red: `#ff4940`
- Tangerine Warm: `#ffa130`
- Sunflower Yellow: `#ffc837`
- Leaf Green: `#00cc3d`

## Tailwind Config

```js
colors: {
  'portrait-ink': '#08304c',
  'nautical-teal': '#084e72',
  'charcoal': '#353535',
  'graphite': '#2c2c2c',
  'slate-helper': '#797979',
  'iron': '#585858',
  'ash': '#dedede',
  'fog': '#c7c7c7',
  'mist': '#eeeeee',
  'mint-wash': '#d7ffe2',
  'sky-wash': '#e8f1ff',
  'peach-wash': '#ffebd6',
}
```

---

**Tags**: #design #colors #palette #tailwind
