import { ThemeToggle } from "@/components/theme/theme-toggle";

export function ThemeCorner() {
  return (
    <div className="fixed right-4 top-4 z-50">
      <ThemeToggle compact />
    </div>
  );
}
