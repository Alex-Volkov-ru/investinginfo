-- Исправление ограничения уникальности для категорий
-- Теперь можно создавать категории с тем же именем после удаления

-- Удаляем старое ограничение
ALTER TABLE pf.budget_categories DROP CONSTRAINT IF EXISTS budget_categories_user_id_kind_name_key;

-- Создаем частичный индекс для уникальности только активных категорий
-- Это позволяет иметь несколько неактивных категорий с одинаковыми именами
-- но только одну активную категорию с данным именем
CREATE UNIQUE INDEX budget_categories_active_unique_idx 
ON pf.budget_categories (user_id, kind, name) 
WHERE is_active = TRUE;

-- Комментарий для документации
COMMENT ON INDEX budget_categories_active_unique_idx 
IS 'Уникальность имени категории только для активных записей';
