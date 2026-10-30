/**
 * Remounted on each page, not on a filter: the new page fades in, as in an
 * installed application (globals.css). Opacity only: a transform here
 * would carry « Vendre » away from the bottom of the screen.
 */
export default function WorkspaceTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="page-enter flex flex-1 flex-col gap-6">{children}</div>
  );
}
