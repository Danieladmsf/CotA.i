/**
 * Calcula o preço por unidade de medida (Kg, Lt, etc) baseado na embalagem
 *
 * @param packagePrice - Preço total da embalagem
 * @param unitsPerPackage - Número de unidades dentro da embalagem (ex: 15 garrafas)
 * @param unitWeight - Peso/volume de cada unidade (ex: 0.9 Lt por garrafa)
 * @returns Preço por unidade de medida (ex: R$/Lt, R$/Kg)
 *
 * @example
 * // Azeite: 15 garrafas de 900ml por R$ 66,90
 * calculatePricePerUnit(66.90, 15, 0.9) // = R$ 4,95/Lt
 *
 * @example
 * // Açúcar: 2 sacos de 25Kg por R$ 100,00
 * calculatePricePerUnit(100, 2, 25) // = R$ 2,00/Kg
 */
export function calculatePricePerUnit(
  packagePrice: number,
  unitsPerPackage: number,
  unitWeight: number
): number {
  if (unitsPerPackage <= 0 || unitWeight <= 0) {
    return 0;
  }

  // Total de peso/volume na embalagem
  const totalVolumeOrWeight = unitsPerPackage * unitWeight;

  // Preço por unidade de medida (Kg, Lt, etc)
  return packagePrice / totalVolumeOrWeight;
}

/**
 * Calcula o valor total do pedido
 *
 * @param requiredPackages - Número de embalagens necessárias
 * @param packagePrice - Preço por embalagem
 * @returns Valor total
 */
export function calculateTotalOrderValue(
  requiredPackages: number,
  packagePrice: number
): number {
  return requiredPackages * packagePrice;
}

/**
 * Calcula a quantidade total oferecida
 *
 * @param requiredPackages - Número de embalagens
 * @param unitsPerPackage - Unidades por embalagem
 * @param unitWeight - Peso/volume unitário
 * @returns Quantidade total
 */
export function calculateTotalOffered(
  requiredPackages: number,
  unitsPerPackage: number,
  unitWeight: number
): number {
  return requiredPackages * unitsPerPackage * unitWeight;
}
