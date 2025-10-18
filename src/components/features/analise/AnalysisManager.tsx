"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Package
} from "lucide-react";
import PriceAnalysisClient from "./PriceAnalysisClient";
import PriceAnalysisEnhanced from "./PriceAnalysisEnhanced";
import PriceHistoryTab from "./PriceHistoryTab";

export default function AnalysisManager() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Tabs principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Análise Detalhada
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Histórico de Preços
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <PriceAnalysisClient />
        </TabsContent>

        <TabsContent value="advanced">
          <PriceAnalysisEnhanced />
        </TabsContent>

        <TabsContent value="history">
          <PriceHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
