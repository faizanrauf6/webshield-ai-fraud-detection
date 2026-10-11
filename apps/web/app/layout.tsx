import type { Metadata } from 'next';
import { Shell } from '../components/shell';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'WebShield AI — Website risk intelligence', template: '%s · WebShield AI' },
  description:
    'Explainable website-risk analysis with transparent evidence and research-first evaluation.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
