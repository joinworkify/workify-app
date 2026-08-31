import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { OrgError } from '@/lib/org/client';
import { cn } from '@/lib/utils';

type AddMemberDialogProps = {
  isOwner: boolean;
  onAdd: (email: string, role: 'member' | 'admin') => Promise<void>;
};

export function AddMemberDialog({ isOwner, onAdd }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onAdd(trimmed, role);
      setEmail('');
      setRole('member');
      setOpen(false);
    } catch (err) {
      if (err instanceof OrgError && err.code === 'user_not_found') {
        setError('No signed-up user found with that email.');
      } else if (err instanceof OrgError && err.code === 'no_seats_available') {
        setError('No seats left on this plan.');
      } else {
        setError('Failed to add member.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Text className="text-primary-foreground">Add member</Text>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
        </DialogHeader>
        <View className="gap-4">
          <View className="gap-2">
            <Label nativeID="add-member-email">Email</Label>
            <Input
              aria-labelledby="add-member-email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="member@company.com"
              className="bg-muted h-12 rounded-lg border-0"
            />
          </View>
          {isOwner ? (
            <View className="flex-row gap-2">
              {(['member', 'admin'] as const).map((option) => (
                <Button
                  key={option}
                  variant={role === option ? 'default' : 'outline'}
                  size="sm"
                  onPress={() => setRole(option)}
                  className="flex-1">
                  <Text className={cn(role === option && 'text-primary-foreground')}>
                    {option === 'member' ? 'Member' : 'Admin'}
                  </Text>
                </Button>
              ))}
            </View>
          ) : null}
          {error ? (
            <Text className="text-destructive" variant="small">
              {error}
            </Text>
          ) : null}
        </View>
        <DialogFooter>
          <Button disabled={isSubmitting || !email.trim()} onPress={handleSubmit}>
            <Text className="text-primary-foreground">
              {isSubmitting ? 'Adding…' : 'Add member'}
            </Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
