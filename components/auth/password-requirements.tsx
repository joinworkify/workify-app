import { Check, X } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const REQUIREMENTS = [
  { label: 'At least 8 characters', test: (password: string) => password.length >= 8 },
  { label: 'One letter', test: (password: string) => /[a-zA-Z]/.test(password) },
  { label: 'One number', test: (password: string) => /[0-9]/.test(password) },
];

export function passwordMeetsRequirements(password: string) {
  return REQUIREMENTS.every((requirement) => requirement.test(password));
}

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <View className="gap-1">
      {REQUIREMENTS.map((requirement) => {
        const met = requirement.test(password);
        return (
          <View key={requirement.label} className="flex-row items-center gap-1.5">
            <Icon
              as={met ? Check : X}
              size={14}
              className={met ? 'text-primary' : 'text-muted-foreground'}
            />
            <Text variant="small" className={cn(met ? 'text-primary' : 'text-muted-foreground')}>
              {requirement.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
