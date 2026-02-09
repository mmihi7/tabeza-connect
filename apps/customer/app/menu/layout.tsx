/**
 * Menu Layout
 * Task 9: Menu Route Protection
 * 
 * Protects the menu route and redirects to /tab in Basic mode.
 */

import { MenuWrapper } from './MenuWrapper';

export default function MenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MenuWrapper>{children}</MenuWrapper>;
}
