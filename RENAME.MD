
⏺ Based on my analysis of the project files, here's a
  comprehensive overview of the Aether Mail Client's design
  system:

  Color Palette

  Primary Colors

  - Primary Purple: #7c3aed / rgba(124, 58, 237, 0.8)
  - Primary Light: #8b5cf6
  - Primary Dark: #6d28d9
  - Accent Purple: #6366f1 / rgba(99, 102, 241, 0.8)
  - Accent Light: #818cf8
  - Secondary Purple: #8b5cf6 (Indigo variation)

  Background Colors

  - Dark Background: #0a0a0a (Deep black)
  - Dark Secondary: #1a0a2e (Dark purple-tinted)
  - Glass Background: rgba(15, 15, 20, 0.85) (Semi-transparent
  dark)
  - Card Background: rgba(255, 255, 255, 0.05) (Very subtle
  white with backdrop blur)
  - Hover Background: rgba(124, 58, 237, 0.05) to rgba(124, 58, 
  237, 0.08) (Purple-tinted)

  Text Colors

  - Primary Text: #ffffff / var(--text-primary)
  - Secondary Text: rgba(255, 255, 255, 0.7) /
  var(--text-secondary)
  - Muted Text: rgba(255, 255, 255, 0.5) / var(--text-muted)

  Border Colors

  - Primary Border: rgba(124, 58, 237, 0.2)
  - Secondary Border: rgba(124, 58, 237, 0.1)
  - Hover Border: rgba(124, 58, 237, 0.3) to rgba(124, 58, 237, 
  0.5)

  Status Colors

  - Success/Active: #10b981 (Green)
  - Warning: #f59e0b / #fbbf24 (Amber/Yellow)
  - Error/Danger: #ef4444 (Red)
  - Inactive: #f59e0b (Amber)

  ---
  UI Design Style

  1. Glassmorphism (Primary Design Language)

  The entire app uses a modern glassmorphism aesthetic:

  // Standard glass card
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(124, 58, 237, 0.2);
  border-radius: 16px;
  box-shadow:
    0 8px 32px 0 rgba(31, 38, 135, 0.2),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.05);

  Characteristics:
  - Semi-transparent backgrounds
  - Heavy backdrop blur effects
  - Subtle inset highlights for depth
  - Layered shadows for elevation
  - Rounded corners (12-16px)

  2. Quantum/Aether Theme

  The app features cosmic/quantum-inspired visual effects:

  Quantum Background Particles:
  // Animated particle effects
  background-image:
    radial-gradient(circle at 20% 50%, rgba(124, 58, 237, 0.1)
  0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.08)
  0%, transparent 50%),
    radial-gradient(circle at 40% 20%, rgba(139, 92, 246, 0.06)
  0%, transparent 50%);

  Rotating Particles (on cards):
  &::before {
    background: radial-gradient(circle, rgba(124, 58, 237, 0.1)
  0%, transparent 70%);
    animation: rotate 20s linear infinite;
  }

  3. Gradient Text

  Headers and important text use purple gradients:

  h1, h2 {
    background: linear-gradient(135deg, #7c3aed, #6366f1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  4. Button Styles

  Primary Buttons:
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.8),
  rgba(99, 102, 241, 0.8));
  backdrop-filter: blur(10px);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px 0 rgba(124, 58, 237, 0.4);
  }

  Secondary Buttons:
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(124, 58, 237, 0.3);
  color: var(--text-primary);

  Danger Buttons:
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;

  5. Form Inputs

  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(124, 58, 237, 0.2);
  color: var(--text-primary);

  &:focus {
    border-color: var(--primary);
    box-shadow:
      0 0 0 3px rgba(124, 58, 237, 0.1),
      0 4px 12px rgba(124, 58, 237, 0.2);
  }

  6. Animations

  Fade In (Page Load):
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  Hover Transforms:
  - Cards: translateY(-2px) to translateY(-5px)
  - List items: translateX(4px) (slide right)
  - Buttons: translateY(-2px) with enhanced shadow

  Particle Rotation:
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  Shimmer Effect (Progress bars):
  @keyframes shimmer {
    from { transform: translateX(-100px); }
    to { transform: translateX(100px); }
  }

  7. Typography

  - Font: System fonts (not specified custom fonts)
  - Heading Sizes:
    - H1: 2.5rem (40px)
    - H2: 1.5rem - 2rem (24-32px)
    - H3: 1.1rem - 1.4rem (17.6-22.4px)
  - Body Text: 0.95rem (15.2px)
  - Small Text: 0.9rem (14.4px)
  - Letter Spacing: 0.5px - 2px for uppercase labels
  - Line Height: 1.6 - 1.8 for readability

  8. Spacing System

  - Cards: 16px border-radius, 2rem (32px) padding
  - Buttons: 12px border-radius, 10-16px padding
  - Sections: 2.5rem - 3rem (40-48px) margin-bottom
  - Grid Gap: 2rem (32px) for card grids
  - List Items: 0.75rem - 0.85rem (12-13.6px) padding

  9. Shadows

  Card Elevation:
  box-shadow:
    0 8px 32px 0 rgba(31, 38, 135, 0.2),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.05);

  Button Hover:
  box-shadow: 0 8px 25px 0 rgba(124, 58, 237, 0.4);

  Featured Elements:
  box-shadow: 0 0 40px rgba(124, 58, 237, 0.4);

  ---
  Design Principles

  1. Dark-First: Entire app uses dark theme (no light mode
  currently)
  2. Consistency: Purple everywhere - no mixed color schemes
  3. Depth: Multiple layers using transparency and blur
  4. Interactivity: Hover states on everything clickable
  5. Minimalism: Clean, text-focused (emojis removed)
  6. Fluidity: Smooth transitions (0.2s - 0.3s)
  7. Accessibility: Clear contrast, visible focus states

  ---
  Overall Aesthetic

  "Quantum Purple Glassmorphism" - A futuristic, ethereal email
  client with:
  - Deep space-like dark backgrounds
  - Floating glass-like UI elements
  - Cosmic purple particle effects
  - Smooth, fluid animations
  - Modern, clean typography
  - High-tech, premium feel

  The design evokes a sense of privacy, security, and
  cutting-edge technology - perfect for a privacy-focused email
  service.