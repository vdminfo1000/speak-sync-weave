import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu, Briefcase, Wallet, Fingerprint, Plane, HelpCircle, Settings, Users } from "lucide-react";

const AdditionalMenu = () => {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => navigate("/social-network")}>
          <Users className="w-4 h-4 mr-2" />
          Социальная сеть
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/business-environment")}>
          <Briefcase className="w-4 h-4 mr-2" />
          Бизнес среда
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/wallet")}>
          <Wallet className="w-4 h-4 mr-2" />
          Кошелек
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/digital-id")}>
          <Fingerprint className="w-4 h-4 mr-2" />
          Цифровое ID
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/travel")}>
          <Plane className="w-4 h-4 mr-2" />
          Путешествия
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <Settings className="w-4 h-4 mr-2" />
          Настройки
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/help")}>
          <HelpCircle className="w-4 h-4 mr-2" />
          Помощь
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AdditionalMenu;
