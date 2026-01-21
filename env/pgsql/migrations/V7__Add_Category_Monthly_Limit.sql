-- Добавление поля monthly_limit для категорий расходов
ALTER TABLE pf.budget_categories 
ADD COLUMN monthly_limit NUMERIC(20,2) NULL;

COMMENT ON COLUMN pf.budget_categories.monthly_limit IS 'Месячный лимит расходов для категории (NULL = без лимита)';

