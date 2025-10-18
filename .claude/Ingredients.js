
import React, { useState, useEffect } from "react";
import { Ingredient } from "@/entities/Ingredient";
import { PriceHistory } from "@/entities/PriceHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Package,
  TrendingUp,
  Upload,
  BarChart3,
  Store
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import BrandsManager from "../components/ingredients/BrandsManager";
import ImportManager from "../components/ingredients/ImportManager";
import AnalysisManager from "../components/ingredients/AnalysisManager"; // Added new import

export default function Ingredients() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    traditional: 0,
    commercial: 0
  });

  const navigate = useNavigate();

  useEffect(() => {
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    try {
      console.log('[pages/Ingredients.js] 🔍 Carregando ingredientes unificados...');
      setLoading(true);
      setError(null);

      // Carregar apenas ingredientes unificados
      const allIngredients = await Ingredient.list();

      console.log('[pages/Ingredients.js] 📊 Dados carregados:', allIngredients?.length || 0);

      // Processar ingredientes
      const processedIngredients = (allIngredients || []).map(ingredient => ({
        ...ingredient,
        displayName: ingredient.name,
        displayPrice: ingredient.current_price,
        displaySupplier: ingredient.main_supplier || 'N/A',
        displayBrand: ingredient.brand || 'N/A'
      }));

      // Filtrar ingredientes ativos
      const activeIngredients = processedIngredients.filter(ing => ing.active !== false);

      console.log('[pages/Ingredients.js] ✅ Resultado final:');
      console.log('[pages/Ingredients.js] - Total:', processedIngredients.length);
      console.log('[pages/Ingredients.js] - Ativos:', activeIngredients.length);

      setIngredients(activeIngredients);
      setStats({
        total: processedIngredients.length,
        active: activeIngredients.length,
        traditional: activeIngredients.filter(ing =>
          ing.ingredient_type === 'traditional' || ing.ingredient_type === 'both'
        ).length,
        commercial: activeIngredients.filter(ing =>
          ing.ingredient_type === 'commercial' || ing.ingredient_type === 'both'
        ).length
      });

    } catch (err) {
      console.error('[pages/Ingredients.js] ❌ Erro ao carregar ingredientes:', err);
      setError('Erro ao carregar ingredientes: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ingredient) => {
    if (window.confirm(`Tem certeza que deseja excluir o ingrediente "${ingredient.name}"?`)) {
      try {
        await Ingredient.delete(ingredient.id);
        await loadIngredients();
      } catch (err) {
        setError('Erro ao excluir ingrediente: ' + err.message);
      }
    }
  };

  // Filtros
  const uniqueCategories = [...new Set(ingredients.map(ing => ing.category).filter(Boolean))];
  const uniqueSuppliers = [...new Set(ingredients.map(ing => ing.main_supplier).filter(Boolean))];

  const filteredIngredients = ingredients.filter(ingredient => {
    const matchesSearch = ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ingredient.displaySupplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ingredient.displayBrand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || ingredient.category === categoryFilter;
    const matchesSupplier = supplierFilter === "all" || ingredient.main_supplier === supplierFilter;

    return matchesSearch && matchesCategory && matchesSupplier;
  });

  if (loading) {
    return <div className="p-8">Carregando ingredientes...</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ingredientes</h1>
          <p className="text-gray-500">Gerencie seus ingredientes e preços</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Removed direct button for IngredientAnalysis, now using a tab */}
          <Button onClick={() => navigate(createPageUrl('IngredientEditor'))}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Ingrediente
          </Button>
        </div>
      </div>

      {/* Tabs principais - agora com 4 tabs */}
      <Tabs defaultValue="ingredients" className="w-full">
        <TabsList className="grid w-full grid-cols-4"> {/* Changed to grid-cols-4 */}
          <TabsTrigger value="ingredients" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Ingredientes
          </TabsTrigger>
          <TabsTrigger value="brands" className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            Marcas
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2"> {/* New tab trigger */}
            <BarChart3 className="w-4 h-4" />
            Análise Detalhada
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Importação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ingredients" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total</CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Ativos</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.active}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Para Receitas</CardTitle>
                <Package className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.traditional}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Comerciais</CardTitle>
                <Store className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.commercial}</div>
              </CardContent>
            </Card>
          </div>

          {/* Busca e Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar ingredientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {uniqueCategories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos fornecedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos fornecedores</SelectItem>
                {uniqueSuppliers.map(supplier => (
                  <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Tabela de Ingredientes */}
          <Card>
            <CardHeader>
              <CardTitle>Lista de Ingredientes ({filteredIngredients.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4">Nome</th>
                      <th className="text-left p-4">Unidade</th>
                      <th className="text-left p-4">Categoria</th>
                      <th className="text-left p-4">Marca</th>
                      <th className="text-left p-4">Preço Atual</th>
                      <th className="text-left p-4">Fornecedor</th>
                      <th className="text-left p-4">Última Atualização</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-left p-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIngredients.map((ingredient) => (
                      <tr key={ingredient.id} className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          <div>
                            <div className="font-medium">{ingredient.name}</div>
                            {ingredient.taco_variations && ingredient.taco_variations.length > 0 && (
                              <Badge
                                variant="outline"
                                className="mt-1 bg-green-50 text-green-700 border-green-200"
                              >
                                {ingredient.taco_variations.length} TACO
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4">{ingredient.unit}</td>
                        <td className="p-4">{ingredient.category || 'N/A'}</td>
                        <td className="p-4">{ingredient.displayBrand}</td>
                        <td className="p-4">
                          R$ {ingredient.displayPrice?.toFixed(2).replace('.', ',') || '0,00'}
                        </td>
                        <td className="p-4">{ingredient.displaySupplier}</td>
                        <td className="p-4">
                          {ingredient.last_update ?
                            new Date(ingredient.last_update).toLocaleDateString('pt-BR') :
                            'N/A'}
                        </td>
                        <td className="p-4">
                          <Badge variant={ingredient.active ? "success" : "secondary"}>
                            {ingredient.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem
                                onClick={() => navigate(createPageUrl(`IngredientEditor?id=${ingredient.id}`))}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(ingredient)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredIngredients.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum ingrediente encontrado
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brands" className="space-y-6">
          <BrandsManager />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6"> {/* New tab content */}
          <AnalysisManager />
        </TabsContent>

        <TabsContent value="import" className="space-y-6">
          <ImportManager onImportComplete={loadIngredients} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
