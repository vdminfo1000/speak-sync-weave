import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { z } from "zod";
import { AvatarUpload } from "@/components/AvatarUpload";
import RingtoneSettings from "@/components/RingtoneSettings";

const profileSchema = z.object({
  username: z.string().trim().min(2, "Имя пользователя должно содержать минимум 2 символа").max(50, "Имя пользователя должно быть короче 50 символов"),
  full_name: z.string().trim().max(100, "Имя должно быть короче 100 символов").optional().or(z.literal("")),
  phone_number: z.string().trim().regex(/^(\+?[1-9]\d{1,14})?$/, "Неверный формат номера телефона").optional().or(z.literal("")),
});

const passwordSchema = z.object({
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string>("");
  
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showRingtoneSettings, setShowRingtoneSettings] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("username, full_name, phone_number, is_public, avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (profile) {
        setUsername(profile.username || "");
        setFullName(profile.full_name || "");
        setPhoneNumber(profile.phone_number || "");
        setIsPublic(profile.is_public ?? true);
        setAvatarUrl(profile.avatar_url || "");
      }
    } catch (error) {
      toast.error(getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);

      // Validate profile data
      const profileData = profileSchema.parse({
        username,
        full_name: fullName,
        phone_number: phoneNumber,
      });

      const { error } = await supabase
        .from("profiles")
        .update({
          username: profileData.username,
          full_name: profileData.full_name || null,
          phone_number: profileData.phone_number || null,
          is_public: isPublic,
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Профиль успешно обновлен");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(getUserFriendlyError(error));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (!newPassword.trim()) {
        toast.error("Введите новый пароль");
        return;
      }

      setSaving(true);

      // Validate password
      passwordSchema.parse({ password: newPassword });

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Пароль успешно изменен");
      setNewPassword("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(getUserFriendlyError(error));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl p-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад к мессенджеру
        </Button>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Настройки профиля</CardTitle>
              <CardDescription>
                Обновите информацию профиля и настройки приватности
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <AvatarUpload
                  currentAvatarUrl={avatarUrl}
                  userId={userId}
                  username={username}
                  onAvatarUpdated={setAvatarUrl}
                />
                <div className="flex-1 flex items-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowRingtoneSettings(true)}
                    className="w-full"
                  >
                    Настройка мелодии звонка
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Имя пользователя *</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Введите имя пользователя"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Полное имя</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Введите полное имя"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Номер телефона</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="isPublic">Публичный профиль</Label>
                  <p className="text-sm text-muted-foreground">
                    Разрешить другим пользователям находить вас в поиске
                  </p>
                </div>
                <Switch
                  id="isPublic"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  "Сохранить профиль"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Изменить пароль</CardTitle>
              <CardDescription>
                Обновите пароль вашей учетной записи
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Новый пароль</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Введите новый пароль (минимум 6 символов)"
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={saving || !newPassword}
                className="w-full"
                variant="secondary"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Изменение...
                  </>
                ) : (
                  "Изменить пароль"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <RingtoneSettings
        isOpen={showRingtoneSettings}
        onClose={() => setShowRingtoneSettings(false)}
        currentUserId={userId}
      />
    </div>
  );
};

export default Profile;
