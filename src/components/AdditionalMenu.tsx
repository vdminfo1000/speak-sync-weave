import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu, Wallet, FileText, HelpCircle, Settings, Globe, Search } from "lucide-react";

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
        <DropdownMenuItem onClick={() => navigate("/search")}>
          <Search className="w-4 h-4 mr-2" />
          Поиск
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/cyber-world")}>
          <Globe className="w-4 h-4 mr-2" />
          Кибермир
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/wallet")}>
          <Wallet className="w-4 h-4 mr-2" />
          Кошелек
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/documents")}>
          <FileText className="w-4 h-4 mr-2" />
          Документы
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
