export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthenticatedApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
