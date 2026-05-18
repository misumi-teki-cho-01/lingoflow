import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './locale-switcher';
import { LogoutButton } from './logout-button';
import { ThemeSwitcher } from './theme-switcher';

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/88 backdrop-blur-md">
      <div className="flex h-12 w-full items-center justify-between px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2.5 text-foreground transition-opacity hover:opacity-80"
        >
          <span className="relative h-7 w-7 shrink-0">
            <Image
              src="/logo/lingoflow-black-line.png"
              alt="LingoFlow logo"
              width={28}
              height={28}
              className="h-7 w-7 object-contain dark:hidden"
            />
            <Image
              src="/logo/lingflow-white-line.png"
              alt="LingoFlow logo"
              width={28}
              height={28}
              className="hidden h-7 w-7 object-contain dark:block"
            />
          </span>
          <span className="text-base font-semibold tracking-tight sm:text-lg">LingoFlow</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <ThemeSwitcher />
          <LocaleSwitcher />
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
