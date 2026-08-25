import { FileText, MessageCircle, Search, Tractor, Wrench } from 'lucide-react-native';
import type { ComponentProps } from 'react';
import { Image, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

const logo = require('@/assets/images/workify-logo.png');

type LucideIconType = ComponentProps<typeof Icon>['as'];

function FloatingIcon({
  as,
  size = 20,
  className,
}: {
  as: LucideIconType;
  size?: number;
  className?: string;
}) {
  return (
    <View
      className={cn(
        'bg-primary-foreground/15 absolute items-center justify-center rounded-2xl p-2.5',
        className
      )}>
      <Icon as={as} size={size} className="text-primary-foreground" />
    </View>
  );
}

// Fills whatever space its parent gives it (meant to sit in a flex-1 container) and centers a
// fixed-size cluster in it -- the icon scatter is positioned relative to that fixed cluster, not
// the parent, so it stays a tight group around the badge instead of stretching to the parent's
// edges when the parent's flex-1 height varies (e.g. a short sign-in form leaves far more hero
// space than a longer sign-up form).
export function AuthHero({ size = 92 }: { size?: number }) {
  const logoSize = Math.round(size * 0.57);
  const clusterSize = size + 140;

  return (
    <View className="w-full flex-1 items-center justify-center" pointerEvents="none">
      <View className="items-center justify-center" style={{ width: clusterSize, height: clusterSize }}>
        <FloatingIcon as={Tractor} size={22} className="left-2 top-4 -rotate-6" />
        <FloatingIcon as={Wrench} size={16} className="right-4 top-0 rotate-12" />
        <FloatingIcon as={Search} size={14} className="left-1/2 top-0 -ml-4 -rotate-6" />
        <FloatingIcon as={FileText} size={16} className="bottom-0 left-4 rotate-3" />
        <FloatingIcon as={MessageCircle} size={22} className="bottom-4 right-2 rotate-6" />
        <View
          // Deliberately literal white, not bg-background -- this badge sits on the brand-green
          // hero regardless of theme, so it must not follow dark mode's dark background token.
          className="items-center justify-center rounded-3xl bg-white shadow-sm shadow-black/10"
          style={{ width: size, height: size }}>
          <Image
            source={logo}
            resizeMode="contain"
            style={{ width: logoSize, height: (logoSize * 286) / 338 }}
          />
        </View>
      </View>
    </View>
  );
}
