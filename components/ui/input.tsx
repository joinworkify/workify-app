import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useColorScheme } from 'nativewind';
import { Platform, TextInput } from 'react-native';

function Input({
  className,
  placeholderTextColor,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  const { colorScheme } = useColorScheme();
  return (
    <TextInput
      className={cn(
        'dark:bg-input/30 border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9',
        props.editable === false &&
        cn(
          'opacity-50',
          Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
        ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
          ),
        }),
        className
      )}
      // NativeWind's TextInput interop has no placeholder-color mapping (only `style`/`textAlign`
      // are wired up), so the `placeholder:` class variant above is a no-op on native and RN
      // falls back to its own low-contrast default -- set the real prop instead.
      placeholderTextColor={placeholderTextColor ?? THEME[colorScheme ?? 'light'].mutedForeground}
      {...props}
    />
  );
}

export { Input };
