//Hàm test cho file recipeRecommendService.js
const {
    normalizeIngredientIds,
    recommendRecipesByIngredientIds,
    RECIPE_RECOMMEND_QUERY,
} = require('../src/services/recipeRecommendService');

describe('recipeRecommendService', () => {
    //đây là nhóm test case về hàm normalizeIngredientIds, nó sẽ kiểm tra xem hàm có trả về null khi đầu vào là rỗng hoặc không phải là mảng hay không, và kiểm tra xem hàm có trả về mảng đã được chuẩn hóa, lọc bỏ giá trị không hợp lệ và loại bỏ trùng lặp hay không.
    describe('normalizeIngredientIds', () => {

        //Test input
        test('Trả về null khi đầu vào là rỗng hoặc không phải là mảng', () => {
            expect(normalizeIngredientIds()).toBeNull();
            expect(normalizeIngredientIds([])).toBeNull();
            expect(normalizeIngredientIds('1,2')).toBeNull();
        });
        //Test chuẩn hóa 
        test('Chuẩn hóa các id hợp lệ, lọc bỏ giá trị không hợp lệ và loại bỏ trùng lặp', () => {
            expect(normalizeIngredientIds([1, '2', 2, 0, -1, 'abc', 3])).toEqual([1, 2, 3]);
        });
    });

    describe('recommendRecipesByIngredientIds', () => {
        //Test lỗi 400 khi danh sách nguyên liệu không hợp lệ
        test('Lỗi 400 khi danh sách nguyên liệu không hợp lệ', async () => {
            const dbMock = { query: jest.fn() };

            await expect(recommendRecipesByIngredientIds(dbMock, [])).rejects.toMatchObject({
                statusCode: 400,
                message: 'Danh sách nguyên liệu không hợp lệ',
            });

            expect(dbMock.query).not.toHaveBeenCalled();  //input sai sẽ ko được gọi đến db.query
        });

        //Test gọi db.query với các id đã được chuẩn hóa và trả về các hàng kết quả
        test('Gọi db.query với các id đã được chuẩn hóa và trả về các hàng kết quả', async () => {
            const mockRows = [
                { recipe_id: 1, title: 'Trứng chiên hành', match_count: '2' },
                { recipe_id: 3, title: 'Mì xào trứng', match_count: '1' },
            ];

            const dbMock = {
                query: jest.fn().mockResolvedValue({ rows: mockRows }),
            };

            const rows = await recommendRecipesByIngredientIds(dbMock, ['1', 2, 2, '3']);

            expect(dbMock.query).toHaveBeenCalledTimes(1);
            expect(dbMock.query).toHaveBeenCalledWith(RECIPE_RECOMMEND_QUERY, [[1, 2, 3]]);
            expect(rows).toEqual(mockRows);
        });
    });
});
