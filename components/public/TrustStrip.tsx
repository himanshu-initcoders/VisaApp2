export function TrustStrip() {
  // Partner logos - these would be real logos in production
  const partners = [
    { name: 'Visa', logo: '/logos/visa.svg' },
    { name: 'Mastercard', logo: '/logos/mastercard.svg' },
    { name: 'American Express', logo: '/logos/amex.svg' },
    { name: 'PayPal', logo: '/logos/paypal.svg' },
    { name: 'Stripe', logo: '/logos/stripe.svg' },
  ];

  return (
    <section className="py-8 border-t border-b border-ash-divider/30">
      <div className="max-w-7xl mx-auto px-4">
        <p className="text-center text-xs uppercase tracking-wider text-slate-helper mb-6">
          Trusted by leading travel brands
        </p>

        <div className="flex items-center justify-center gap-12 flex-wrap">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
            >
              {/* Placeholder - replace with actual logos */}
              <div className="w-24 h-8 bg-graphite/10 rounded flex items-center justify-center">
                <span className="text-xs text-graphite/50">{partner.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
