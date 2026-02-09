import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { List, CreditCard, FileText } from "lucide-react";
import Logo from "/logo.jpeg";

const LoginSelection = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600 p-4">
      <Card className="w-full max-w-4xl bg-white rounded-lg shadow-xl">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="flex justify-center">
            <img 
              src={Logo} 
              alt="Logo" 
              className="h-20 w-20 object-contain" 
              style={{ maxWidth: '100px' }}
            />
          </div>
          <CardTitle className="text-4xl font-bold text-blue-600">WebWave Business</CardTitle>
          <CardDescription className="text-lg text-gray-600">Select a service to continue</CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <div className="grid gap-6 md:grid-cols-3">
            {/* CRM Login Button */}
            <Button
              className="h-auto flex flex-col items-center justify-center p-8 space-y-4 bg-blue-600 hover:bg-blue-700 text-white transition-colors rounded-lg"
              onClick={() => navigate("/auth")}
            >
              <List className="h-10 w-10 text-white" />
              <div className="text-center">
                <div className="font-semibold text-xl">CRM System</div>
                <div className="text-sm text-white/90 mt-2">
                  Customer Relationship Management
                </div>
              </div>
            </Button>

            {/* Payment Login Button */}
            <Button
              className="h-auto flex flex-col items-center justify-center p-8 space-y-4 bg-blue-600 hover:bg-blue-700 text-white transition-colors rounded-lg"
              onClick={() => window.open('https://mywebwavepayment.info', '_blank')}
            >
              <CreditCard className="h-10 w-10 text-white" />
              <div className="text-center">
                <div className="font-semibold text-xl">Payment</div>
                <div className="text-sm text-white/90 mt-2">
                  Payment Management System
                </div>
              </div>
            </Button>

            {/* Invoice/Bill Login Button */}
            <Button
              className="h-auto flex flex-col items-center justify-center p-8 space-y-4 bg-blue-600 hover:bg-blue-700 text-white transition-colors rounded-lg"
              onClick={() => window.open('https://mywebwavebill.info', '_blank')}
            >
              <FileText className="h-10 w-10 text-white" />
              <div className="text-center">
                <div className="font-semibold text-xl">Invoice</div>
                <div className="text-sm text-white/90 mt-2">
                  Invoice & Billing System
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginSelection;
