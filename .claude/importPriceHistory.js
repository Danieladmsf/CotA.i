
import { createClient } from 'npm:@base44/sdk@0.1.0';

const base44 = createClient({
    appId: Deno.env.get('BASE44_APP_ID'),
});

// Função para validar e converter números
const safeToNumber = (value, defaultValue = 0) => {
    if (value === null || value === undefined || String(value).trim() === '') return defaultValue;
    const num = parseFloat(String(value).replace(',', '.'));
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
};

Deno.serve(async (req) => {
    console.log('[importPriceHistory] Received request');
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('[importPriceHistory] Auth header missing');
            return new Response('Unauthorized', { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        base44.auth.setToken(token);
        console.log('[importPriceHistory] Auth token set');

        const requestData = await req.json();
        // Log the first 500 characters to avoid logging excessively large payloads
        console.log('[importPriceHistory] Request data parsed. First 500 chars:', JSON.stringify(requestData).substring(0, 500));

        if (!requestData || !Array.isArray(requestData.priceHistories)) {
            console.error('[importPriceHistory] Invalid request format. Expected: { priceHistories: [...] }', requestData);
            return new Response(JSON.stringify({
                error: 'Formato inválido. Esperado: { priceHistories: [...] }'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        console.log(`[importPriceHistory] Request data validated. Found ${requestData.priceHistories.length} history items.`);

        console.log('[importPriceHistory] Fetching all ingredients...');
        const ingredients = await base44.entities.Ingredient.list();
        console.log(`[importPriceHistory] Fetched ${ingredients?.length || 0} ingredients.`);
        
        const ingredientMap = {};
        if (Array.isArray(ingredients)) {
            ingredients.forEach(ing => {
                if (ing && ing.name) {
                    ingredientMap[ing.name.toLowerCase().trim()] = ing;
                } else {
                    console.warn('[importPriceHistory] Found ingredient with no name or undefined:', ing);
                }
            });
        }
        console.log(`[importPriceHistory] Ingredient map created with ${Object.keys(ingredientMap).length} entries.`);

        const results = {
            created: [],
            errors: [],
            total_processed: requestData.priceHistories.length
        };

        // Processar cada registro de histórico
        for (let i = 0; i < requestData.priceHistories.length; i++) {
            const historyItem = requestData.priceHistories[i];
            console.log(`[importPriceHistory] Processing history item ${i + 1}/${requestData.priceHistories.length}:`, JSON.stringify(historyItem));
            
            try {
                // Validações
                if (!historyItem.ingredient_name || typeof historyItem.ingredient_name !== 'string') {
                    results.errors.push({
                        index: i,
                        reason: "ingredient_name é obrigatório e deve ser string"
                    });
                    console.warn(`[importPriceHistory] Item ${i}: missing ingredient_name.`);
                    continue;
                }

                if (!historyItem.date || typeof historyItem.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(historyItem.date)) {
                    results.errors.push({
                        index: i,
                        ingredient_name: historyItem.ingredient_name,
                        reason: "date é obrigatório, string no formato YYYY-MM-DD"
                    });
                    console.warn(`[importPriceHistory] Item ${i} (${historyItem.ingredient_name}): invalid date format: ${historyItem.date}`);
                    continue;
                }

                const newPrice = safeToNumber(historyItem.new_price, -1); // Use -1 para detectar falha na conversão
                if (newPrice < 0) {
                    results.errors.push({
                        index: i,
                        ingredient_name: historyItem.ingredient_name,
                        reason: "new_price é obrigatório e deve ser um número válido"
                    });
                    console.warn(`[importPriceHistory] Item ${i} (${historyItem.ingredient_name}): invalid new_price: ${historyItem.new_price}`);
                    continue;
                }

                // Encontrar o ingrediente pelo nome
                const ingredientKey = historyItem.ingredient_name.toLowerCase().trim();
                const ingredient = ingredientMap[ingredientKey];

                if (!ingredient) {
                    results.errors.push({
                        index: i,
                        ingredient_name: historyItem.ingredient_name,
                        reason: `Ingrediente não encontrado: "${historyItem.ingredient_name}"`
                    });
                    console.warn(`[importPriceHistory] Item ${i}: Ingredient not found for key: "${ingredientKey}"`);
                    continue;
                }
                console.log(`[importPriceHistory] Item ${i}: Ingredient "${ingredient.name}" (ID: ${ingredient.id}) found.`);

                // Calcular percentage_change se old_price for fornecido
                let percentageChange = 0;
                const oldPrice = historyItem.old_price !== undefined && historyItem.old_price !== null ? safeToNumber(historyItem.old_price, null) : null;

                if (oldPrice !== null) {
                    if (oldPrice !== 0) {
                        percentageChange = ((newPrice - oldPrice) / oldPrice) * 100;
                    } else if (newPrice !== 0) {
                        // Se oldPrice é 0 e newPrice não é 0, a variação percentual é tecnicamente infinita.
                        // Optamos por registrar 0 ou um valor simbólico, dependendo da preferência de negócio.
                        percentageChange = 0; // Ou um valor simbólico como 999999
                        console.log(`[importPriceHistory] Item ${i} (${ingredient.name}): Old price is 0, new price is ${newPrice}. Percentage change set to 0.`);
                    }
                }
                
                // Criar o registro de histórico
                const historyPayload = {
                    ingredient_id: ingredient.id,
                    old_price: oldPrice,
                    new_price: newPrice,
                    supplier: historyItem.supplier?.trim() || ingredient.main_supplier || "", // Usar main_supplier do ingrediente como fallback
                    date: historyItem.date,
                    category: ingredient.category || "Outros", // Usar categoria do ingrediente como fallback
                    percentage_change: percentageChange,
                    min_price: oldPrice !== null ? Math.min(oldPrice, newPrice) : newPrice,
                    max_price: oldPrice !== null ? Math.max(oldPrice, newPrice) : newPrice,
                    total_variation: percentageChange, // Simplificado, pode ser melhorado se houver múltiplos registros
                    price_progression: [{
                        from_price: oldPrice,
                        to_price: newPrice,
                        variation: percentageChange,
                        date: historyItem.date
                    }]
                };
                console.log(`[importPriceHistory] Item ${i}: Payload for PriceHistory.create:`, JSON.stringify(historyPayload));

                const createdHistory = await base44.entities.PriceHistory.create(historyPayload);
                
                results.created.push({
                    ingredient_name: historyItem.ingredient_name,
                    ingredient_id: ingredient.id,
                    history_id: createdHistory.id, // Adicionar o ID do histórico criado
                    new_price: newPrice,
                    date: historyItem.date
                });
                console.log(`[importPriceHistory] Item ${i}: Successfully created PriceHistory (ID: ${createdHistory.id}) for "${ingredient.name}".`);

            } catch (itemError) {
                console.error(`[importPriceHistory] Error processing history item ${i} (${historyItem.ingredient_name || 'N/A'}):`, itemError.message, itemError.stack);
                results.errors.push({
                    index: i,
                    ingredient_name: historyItem.ingredient_name || 'Desconhecido',
                    reason: `Erro ao criar registro de histórico: ${itemError.message}`
                });
            }
        }

        console.log('[importPriceHistory] Processing finished. Results:', JSON.stringify(results));
        return new Response(JSON.stringify(results), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[importPriceHistory] Critical error in handler:', error.message, error.stack);
        return new Response(JSON.stringify({
            error: `Erro no servidor ao importar histórico: ${error.message}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
