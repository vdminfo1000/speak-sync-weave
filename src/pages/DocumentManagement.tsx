import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DocumentManagement = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/messenger")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Документооборот</h1>
      </div>
      
      <div className="container mx-auto p-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>В разработке</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Модуль документооборота находится в разработке. Здесь будет реализована система управления документами с цифровой подписью.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DocumentManagement;
