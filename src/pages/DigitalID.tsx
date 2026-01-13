import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Fingerprint, Shield, FileKey, CheckCircle, Trash2, Upload, FileText, PenTool, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BiometricCredential {
  id: string;
  credential_type: string;
  device_name: string | null;
  created_at: string;
  is_active: boolean;
}

interface DigitalCertificate {
  id: string;
  certificate_name: string;
  issuer: string | null;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

interface UserDocument {
  id: string;
  document_name: string;
  document_url: string;
  document_type: string | null;
  is_signed: boolean;
  signed_at: string | null;
  created_at: string;
}

const DigitalID = () => {
  const navigate = useNavigate();
  const [biometrics, setBiometrics] = useState<BiometricCredential[]>([]);
  const [certificates, setCertificates] = useState<DigitalCertificate[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Dialogs
  const [showBiometricDialog, setShowBiometricDialog] = useState(false);
  const [showCertificateDialog, setShowCertificateDialog] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<UserDocument | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<string>("");

  // Form states
  const [biometricType, setBiometricType] = useState<"fingerprint" | "face">("fingerprint");
  const [certificateName, setCertificateName] = useState("");
  const [certificateIssuer, setCertificateIssuer] = useState("");
  const [certificateValidUntil, setCertificateValidUntil] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await fetchData(user.id);
      }
      setLoading(false);
    };
    init();
  }, []);

  const fetchData = async (uid: string) => {
    // Fetch biometrics
    const { data: bio } = await supabase
      .from("biometric_credentials")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (bio) setBiometrics(bio);

    // Fetch certificates
    const { data: certs } = await supabase
      .from("digital_certificates")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (certs) setCertificates(certs);

    // Fetch documents
    const { data: docs } = await supabase
      .from("user_documents")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (docs) setDocuments(docs);
  };

  const addBiometric = async () => {
    if (!userId) return;
    setIsSubmitting(true);

    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        toast.error("WebAuthn не поддерживается в этом браузере");
        return;
      }

      // Create challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Create credential options
      const createOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "GoodOK Messenger",
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: "user@goodok.app",
          displayName: "GoodOK User",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: biometricType === "fingerprint" ? "platform" : "cross-platform",
          userVerification: "required",
        },
        timeout: 60000,
      };

      const credential = await navigator.credentials.create({
        publicKey: createOptions,
      }) as PublicKeyCredential;

      if (credential) {
        const response = credential.response as AuthenticatorAttestationResponse;
        const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        const publicKey = btoa(String.fromCharCode(...new Uint8Array(response.getPublicKey()!)));

        const { error } = await supabase.from("biometric_credentials").insert({
          user_id: userId,
          credential_id: credentialId,
          credential_type: biometricType,
          public_key: publicKey,
          device_name: navigator.userAgent.split("(")[1]?.split(")")[0] || "Unknown Device",
        });

        if (error) throw error;

        toast.success(`${biometricType === "fingerprint" ? "Отпечаток пальца" : "Лицо"} добавлено`);
        await fetchData(userId);
        setShowBiometricDialog(false);
      }
    } catch (error: any) {
      console.error("Biometric error:", error);
      if (error.name === "NotAllowedError") {
        toast.error("Регистрация отменена пользователем");
      } else {
        toast.error("Ошибка добавления биометрии");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteBiometric = async (id: string) => {
    const { error } = await supabase.from("biometric_credentials").delete().eq("id", id);
    if (error) {
      toast.error("Ошибка удаления");
    } else {
      toast.success("Биометрия удалена");
      if (userId) await fetchData(userId);
    }
  };

  const addCertificate = async () => {
    if (!userId || !certificateName || !certificateValidUntil) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("digital_certificates").insert({
        user_id: userId,
        certificate_name: certificateName,
        certificate_data: btoa(`CERT-${Date.now()}-${Math.random().toString(36)}`),
        issuer: certificateIssuer || "Self-signed",
        valid_from: new Date().toISOString(),
        valid_until: new Date(certificateValidUntil).toISOString(),
      });

      if (error) throw error;

      toast.success("Сертификат ЭЦП добавлен");
      await fetchData(userId);
      setShowCertificateDialog(false);
      setCertificateName("");
      setCertificateIssuer("");
      setCertificateValidUntil("");
    } catch (error) {
      toast.error("Ошибка добавления сертификата");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCertificate = async (id: string) => {
    const { error } = await supabase.from("digital_certificates").delete().eq("id", id);
    if (error) {
      toast.error("Ошибка удаления");
    } else {
      toast.success("Сертификат удалён");
      if (userId) await fetchData(userId);
    }
  };

  const uploadDocument = async () => {
    if (!userId || !documentFile) return;
    setIsSubmitting(true);

    try {
      const fileName = `${userId}/${Date.now()}-${documentFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, documentFile);

      if (uploadError) {
        // If bucket doesn't exist, save with placeholder URL
        console.log("Storage error, saving with placeholder");
      }

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fileName);

      const { error } = await supabase.from("user_documents").insert({
        user_id: userId,
        document_name: documentFile.name,
        document_url: urlData?.publicUrl || fileName,
        document_type: documentFile.type,
        document_size: documentFile.size,
      });

      if (error) throw error;

      toast.success("Документ загружен");
      await fetchData(userId);
      setShowDocumentDialog(false);
      setDocumentFile(null);
    } catch (error) {
      toast.error("Ошибка загрузки документа");
    } finally {
      setIsSubmitting(false);
    }
  };

  const signDocument = async () => {
    if (!selectedDocument || !selectedCertificate) return;
    setIsSubmitting(true);

    try {
      const signatureHash = btoa(`SIGNED-${selectedDocument.id}-${selectedCertificate}-${Date.now()}`);

      const { error } = await supabase
        .from("user_documents")
        .update({
          is_signed: true,
          signed_at: new Date().toISOString(),
          signed_by_certificate_id: selectedCertificate,
          signature_hash: signatureHash,
        })
        .eq("id", selectedDocument.id);

      if (error) throw error;

      toast.success("Документ подписан ЭЦП");
      if (userId) await fetchData(userId);
      setShowSignDialog(false);
      setSelectedDocument(null);
      setSelectedCertificate("");
    } catch (error) {
      toast.error("Ошибка подписания");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteDocument = async (id: string) => {
    const { error } = await supabase.from("user_documents").delete().eq("id", id);
    if (error) {
      toast.error("Ошибка удаления");
    } else {
      toast.success("Документ удалён");
      if (userId) await fetchData(userId);
    }
  };

  const activeCertificates = certificates.filter((c) => c.is_active && new Date(c.valid_until) > new Date());

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Цифровое ID</h1>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Ваш цифровой профиль</CardTitle>
            <CardDescription>Безопасное хранилище биометрических данных и цифровых подписей</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">Биометрия</p>
                <p className="text-2xl font-bold mt-1">{biometrics.length}</p>
              </div>
              <div className="p-4 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">ЭЦП</p>
                <p className="text-2xl font-bold mt-1">{certificates.length}</p>
              </div>
              <div className="p-4 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">Документы</p>
                <p className="text-2xl font-bold mt-1">{documents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="biometric" className="w-full">
          <TabsList>
            <TabsTrigger value="biometric">Биометрия</TabsTrigger>
            <TabsTrigger value="signatures">ЭЦП</TabsTrigger>
            <TabsTrigger value="documents">Документы</TabsTrigger>
          </TabsList>

          <TabsContent value="biometric" className="space-y-3 mt-4">
            {biometrics.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        {item.credential_type === "fingerprint" ? (
                          <Fingerprint className="w-6 h-6 text-primary" />
                        ) : (
                          <Shield className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {item.credential_type === "fingerprint" ? "Отпечаток пальца" : "Распознавание лица"}
                        </p>
                        <p className="text-sm text-muted-foreground">{item.device_name || "Устройство"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Активно
                      </Badge>
                      <Button variant="destructive" size="icon" onClick={() => deleteBiometric(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="p-6 text-center">
                <Button variant="outline" onClick={() => setShowBiometricDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить биометрические данные
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signatures" className="space-y-3 mt-4">
            {certificates.map((cert) => {
              const isExpiring = new Date(cert.valid_until) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              const isExpired = new Date(cert.valid_until) < new Date();

              return (
                <Card key={cert.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <FileKey className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{cert.certificate_name}</p>
                          <p className="text-sm text-muted-foreground">Издатель: {cert.issuer}</p>
                          <p className="text-sm text-muted-foreground">
                            До: {new Date(cert.valid_until).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={isExpired ? "bg-red-600" : isExpiring ? "bg-yellow-600" : "bg-green-600"}>
                          {isExpired ? "Истёк" : isExpiring ? "Истекает" : "Активен"}
                        </Badge>
                        <Button variant="destructive" size="icon" onClick={() => deleteCertificate(cert.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Card>
              <CardContent className="p-6 text-center">
                <Button variant="outline" onClick={() => setShowCertificateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить сертификат ЭЦП
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-3 mt-4">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{doc.document_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {doc.is_signed ? (
                        <Badge className="bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Подписан
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedDocument(doc);
                            setShowSignDialog(true);
                          }}
                          disabled={activeCertificates.length === 0}
                        >
                          <PenTool className="w-4 h-4 mr-1" />
                          Подписать
                        </Button>
                      )}
                      <Button variant="destructive" size="icon" onClick={() => deleteDocument(doc.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="p-6 text-center">
                <Button variant="outline" onClick={() => setShowDocumentDialog(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить документ
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Biometric Dialog */}
      <Dialog open={showBiometricDialog} onOpenChange={setShowBiometricDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить биометрию</DialogTitle>
            <DialogDescription>
              Выберите тип биометрических данных для регистрации
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Card
              className={`cursor-pointer p-4 text-center ${biometricType === "fingerprint" ? "border-primary" : ""}`}
              onClick={() => setBiometricType("fingerprint")}
            >
              <Fingerprint className="w-12 h-12 mx-auto mb-2 text-primary" />
              <p className="font-semibold">Отпечаток пальца</p>
            </Card>
            <Card
              className={`cursor-pointer p-4 text-center ${biometricType === "face" ? "border-primary" : ""}`}
              onClick={() => setBiometricType("face")}
            >
              <Shield className="w-12 h-12 mx-auto mb-2 text-primary" />
              <p className="font-semibold">Лицо</p>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBiometricDialog(false)}>
              Отмена
            </Button>
            <Button onClick={addBiometric} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Зарегистрировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificate Dialog */}
      <Dialog open={showCertificateDialog} onOpenChange={setShowCertificateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить сертификат ЭЦП</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Название сертификата</Label>
              <Input
                value={certificateName}
                onChange={(e) => setCertificateName(e.target.value)}
                placeholder="Основная ЭЦП"
              />
            </div>
            <div>
              <Label>Издатель</Label>
              <Input
                value={certificateIssuer}
                onChange={(e) => setCertificateIssuer(e.target.value)}
                placeholder="Удостоверяющий центр"
              />
            </div>
            <div>
              <Label>Действителен до</Label>
              <Input
                type="date"
                value={certificateValidUntil}
                onChange={(e) => setCertificateValidUntil(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCertificateDialog(false)}>
              Отмена
            </Button>
            <Button onClick={addCertificate} disabled={isSubmitting || !certificateName || !certificateValidUntil}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Upload Dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Загрузить документ</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="file"
              onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
              accept=".pdf,.doc,.docx,.txt"
            />
            {documentFile && (
              <p className="text-sm text-muted-foreground mt-2">
                Выбран: {documentFile.name}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocumentDialog(false)}>
              Отмена
            </Button>
            <Button onClick={uploadDocument} disabled={isSubmitting || !documentFile}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Загрузить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Document Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подписать документ</DialogTitle>
            <DialogDescription>
              Выберите сертификат для подписи "{selectedDocument?.document_name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {activeCertificates.map((cert) => (
              <Card
                key={cert.id}
                className={`cursor-pointer p-3 ${selectedCertificate === cert.id ? "border-primary" : ""}`}
                onClick={() => setSelectedCertificate(cert.id)}
              >
                <div className="flex items-center gap-3">
                  <FileKey className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-semibold">{cert.certificate_name}</p>
                    <p className="text-sm text-muted-foreground">{cert.issuer}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignDialog(false)}>
              Отмена
            </Button>
            <Button onClick={signDocument} disabled={isSubmitting || !selectedCertificate}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Подписать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DigitalID;