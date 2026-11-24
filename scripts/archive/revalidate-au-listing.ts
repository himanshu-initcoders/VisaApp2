import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local' });

async function main() {
  const { revalidatePublicVisaCatalog } = await import(
    '../../lib/revalidate-public-catalog'
  );
  await revalidatePublicVisaCatalog({
    countryCode: 'AU',
    listingId: '553587f2-ccd0-45f0-a7f5-4809caf7f3cb',
    listingSlug: 'Australia-Visa-On-Arrivel',
  });
  console.log('revalidated AU arrival card listing');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
