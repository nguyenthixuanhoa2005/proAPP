const RECIPE_RECOMMEND_QUERY = `
    SELECT
        r.recipe_id,
        r.title,
        r.description,
        r.ingredients_json,
        r.steps_json,
        r.dish_type,
        r.image_url,
        r.total_calories,
        r.cooking_time,
        r.difficulty,
        COUNT(rim.ingredient_id) AS match_count,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT i.name), NULL) AS matched_ingredient_names,
        COALESCE(
            (
                SELECT ARRAY_REMOVE(ARRAY_AGG(DISTINCT i2.name), NULL)
                FROM recipe_ingredient_map rim2
                JOIN ingredient i2 ON i2.ingredient_id = rim2.ingredient_id
                WHERE rim2.recipe_id = r.recipe_id
            ),
            ARRAY[]::text[]
        ) AS all_ingredient_names
    FROM recipe r
    JOIN recipe_ingredient_map rim ON r.recipe_id = rim.recipe_id
    LEFT JOIN ingredient i ON i.ingredient_id = rim.ingredient_id
    WHERE rim.ingredient_id = ANY($1::int[])
    GROUP BY
        r.recipe_id,
        r.title,
        r.description,
        r.ingredients_json,
        r.steps_json,
        r.dish_type,
        r.image_url,
        r.total_calories,
        r.cooking_time,
        r.difficulty
    ORDER BY match_count DESC, r.recipe_id DESC
    LIMIT 10
`;

const normalizeIngredientIds = (ingredientIds) => {
    if (!Array.isArray(ingredientIds) || ingredientIds.length === 0) {
        return null;
    }

    const normalized = ingredientIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

    if (normalized.length === 0) {
        return null;
    }

    return [...new Set(normalized)];
};

const recommendRecipesByIngredientIds = async (dbClient, ingredientIds) => {
    const normalizedIngredientIds = normalizeIngredientIds(ingredientIds);

    if (!normalizedIngredientIds) {
        const error = new Error('Danh sách nguyên liệu không hợp lệ');
        error.statusCode = 400;
        throw error;
    }

    const result = await dbClient.query(RECIPE_RECOMMEND_QUERY, [normalizedIngredientIds]);
    return result.rows;
};

module.exports = {
    RECIPE_RECOMMEND_QUERY,
    normalizeIngredientIds,
    recommendRecipesByIngredientIds,
};
