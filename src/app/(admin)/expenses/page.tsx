import { db } from "@/lib/db";
import { expenseCategories, expensePresets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CategoriesPanel } from "@/components/admin/expenses/categories-panel";

export default async function ExpensesPage() {
  const categories = await db.select().from(expenseCategories).orderBy(expenseCategories.name);
  const presets = await db
    .select({
      id: expensePresets.id,
      name: expensePresets.name,
      defaultAmount: expensePresets.defaultAmount,
      categoryId: expensePresets.categoryId,
      categoryName: expenseCategories.name,
    })
    .from(expensePresets)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expensePresets.categoryId))
    .orderBy(expensePresets.name);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Giderler</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Kategorileri ve tekrarlayan faturalar için varsayılan şablonları ayarlayın.
      </p>
      <CategoriesPanel categories={categories} presets={presets} />
    </div>
  );
}
