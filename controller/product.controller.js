const { database } = require("../config/database");
const { catchAsyncError } = require("../middlewares/catchAsyncError");
const { ErrorHandler } = require("../middlewares/errorMiddleware");
const { getAIRecommendation } = require("../utils/getAiRecomendation");
const cloudinary = require("cloudinary").v2;

//create product
module.exports.createProduct = catchAsyncError(async (req, res, next) => {
  const { name, description, category, price, stock } = req.body;
  const createdBy = req.user.id;
  if (!name || !description || !category || !price || !stock) {
    return next(new ErrorHandler("Please fill all the fields", 400));
  }
  let uploadedImage = [];
  if (req.files && req.files.images) {
    const images = Array.isArray(req.files.images)
      ? req.files.images
      : [req.files.images];
    for (const image of images) {
      const result = await cloudinary.uploader.upload(image.tempFilePath, {
        folder: "eco_pern",
        width: 150,
        crop: "scale",
      });
      uploadedImage.push({
        url: result.secure_url,
        public_id: result.public_id,
      });
    }
  }
  const product = await database.query(
    "insert into products(name, description, price, category, stock, images, created_by) values($1, $2, $3, $4, $5, $6, $7) returning *",
    [
      name,
      description,
      price,
      category,
      stock,
      JSON.stringify(uploadedImage),
      createdBy,
    ],
  );
  res.status(201).json({
    success: true,
    product: product.rows[0],
    message: "Product created successfully",
  });
});
//get all products
module.exports.getAllProducts = catchAsyncError(async (req, res, next) => {
  const { availability, price, category, ratings, search } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const conditions = [];
  const values = [];
  let index = 1;
  let paginationPlaceholders = {};

  // 1. Filter by availability
  if (availability === "in-stock") {
    conditions.push(`p.stock > 5`);
  } else if (availability === "limited") {
    conditions.push(`p.stock > 0 AND p.stock <= 5`);
  } else if (availability === "out-of-stock") {
    conditions.push(`p.stock = 0`);
  }

  // 2. Filter by price
  if (price) {
    const [minPrice, maxPrice] = price.split("-");
    if (minPrice && maxPrice) {
      conditions.push(`p.price between $${index} and $${index + 1}`);
      values.push(minPrice, maxPrice);
      index += 2;
    }
  }

  // 3. Filter by category
  if (category) {
    conditions.push(`p.category ilike $${index}`);
    values.push(`%${category}%`);
    index++;
  }

  // 4. Filter by ratings
  if (ratings) {
    conditions.push(`p.ratings >= $${index}`); // Lưu ý: Sửa thành p.ratings để đồng bộ với db bên dưới của bạn
    values.push(ratings);
    index++;
  }

  // 5. Filter by search
  if (search) {
    conditions.push(
      `(p.name ilike $${index} or p.description ilike $${index})`,
    );
    values.push(`%${search}%`);
    index++;
  }

  // Tạo mệnh đề WHERE hoàn chỉnh
  const whereClause = conditions.length
    ? `where ${conditions.join(" and ")}`
    : "";

  // [Sửa lỗi số 2]: Lấy tổng số lượng sản phẩm (đổi .row thành .rows)
  const totalProductResult = await database.query(
    `select count(*) from products p ${whereClause}`,
    values,
  );
  const totalProducts = parseInt(totalProductResult.rows[0].count) || 0;

  // Thêm tham số phân trang vào mảng values
  paginationPlaceholders.limit = `$${index}`;
  values.push(limit);
  index++;

  paginationPlaceholders.offset = `$${index}`;
  values.push(offset);
  index++;

  // [Sửa lỗi số 3]: Sửa lại SQL lấy danh sách sản phẩm chính xác và đúng cú pháp WHERE
  const query = `
    select p.*, count(r.id) as review_count 
    from products p 
    left join reviews r on p.id = r.product_id 
    ${whereClause} 
    group by p.id 
    order by p.created_at desc
    limit ${paginationPlaceholders.limit} 
    offset ${paginationPlaceholders.offset}
  `;
  const result = await database.query(query, values);

  // Query cho sản phẩm mới
  const newProducts = `
    select p.*, count(r.id) as review_product 
    from products p 
    left join reviews r on p.id = r.product_id 
    group by p.id 
    order by p.created_at desc 
    limit 6
  `;
  const newProductsResult = await database.query(newProducts);

  // Query cho sản phẩm đánh giá cao
  const topRatedProducts = `
    select p.*, count(r.id) as review_product 
    from products p 
    left join reviews r on p.id = r.product_id 
    where p.ratings >= 4.5
    group by p.id 
    order by p.ratings desc, p.created_at desc
    limit 6
  `;
  const topRatedProductsResult = await database.query(topRatedProducts);

  // [Sửa lỗi số 1]: Trả về dữ liệu chính xác (đổi products.rows thành result.rows)
  res.status(200).json({
    success: true,
    products: result.rows,
    newProducts: newProductsResult.rows,
    topRatedProducts: topRatedProductsResult.rows,
    totalProducts,
    message: "Products fetched successfully",
  });
});
//update product
module.exports.updateProduct = catchAsyncError(async (req, res, next) => {
  const { productid } = req.params;
  const { name, description, category, price, stock } = req.body;
  const product = await database.query("select * from products where id = $1", [
    productid,
  ]);
  if (product.rows.length === 0) {
    return next(new ErrorHandler("Product not found", 404));
  }
  const updatedProduct = await database.query(
    `
    update products set name = $1, description = $2, price = $3, category = $4, stock = $5 where id = $6 returning *
  `,
    [name, description, price, category, stock, productid],
  );
  res.status(200).json({
    success: true,
    product: updatedProduct.rows[0],
    message: "Product updated successfully",
  });
});
//delete product
module.exports.deleteProduct = catchAsyncError(async (req, res, next) => {
  const { productid } = req.params;
  const product = await database.query("select * from products where id = $1", [
    productid,
  ]);
  if (product.rows.length === 0) {
    return next(new ErrorHandler("Product not found", 404));
  }
  const images = product.rows[0].images;
  for (const image of images) {
    await cloudinary.uploader.destroy(image.public_id);
  }
  await database.query("delete from products where id = $1 returning*", [
    productid,
  ]);
  return res.status(200).json({
    success: true,
    message: "Product deleted successfully",
  });
});
//get single product
module.exports.getProductDetails = catchAsyncError(async (req, res, next) => {
  const { productid } = req.params;
  const product = await database.query(
    `
    select p.*,
    coalesce(
    json_agg(
    json_build_object(
    'review_id', r.id,
    'rating', r.rating,
    'comment', r.comment,
     'reviewer',json_build_object(
      'id', u.id,
      'name', u.name,
      'avatar', u.avatar
     )
    )) filter (where r.id is not null),'[]')as reviews
    from products p
    left join reviews r on p.id = r.product_id
    left join users u on r.user_id = u.id
    where p.id = $1
    group by p.id
    `,
    [productid],
  );
  return res.status(200).json({
    success: true,
    product: product.rows[0],
    message: "Product details fetched successfully",
  });
});
//post review on product
module.exports.postProductReview = catchAsyncError(async (req, res, next) => {
  const { productid } = req.params;
  const { rating, comment } = req.body;
  if (!rating || !comment) {
    return next(new ErrorHandler("Please provide rating and comment", 400));
  }
  const purchaseCheck = `
  select oi.product_id from order_items oi
  join orders o on oi.order_id = o.id
  join payments p on o.id = p.order_id
  where oi.product_id = $1 and o.buyer_id = $2 and p.payment_status = 'Paid' limit 1`;

  const purchaseResult = await database.query(purchaseCheck, [
    productid,
    req.user.id,
  ]);
  if (purchaseResult.rows.length === 0) {
    return next(
      new ErrorHandler(
        "You can only review products you have purchased and paid for",
        403,
      ),
    );
  }
  const product = await database.query("select * from products where id = $1", [
    productid,
  ]);
  if (product.rows.length === 0) {
    return next(new ErrorHandler("Product not found", 404));
  }
  const existingReview = await database.query(
    "select * from reviews where product_id = $1 and user_id = $2",
    [productid, req.user.id],
  );
  let reviews;
  if (existingReview.rows.length > 0) {
    reviews = await database.query(
      "update reviews set rating = $1, comment = $2 where product_id = $3 and user_id=$4 returning *",
      [rating, comment, productid, req.user.id],
    );
  } else {
    reviews = await database.query(
      "insert into reviews(rating, comment, product_id, user_id) values($1, $2, $3, $4) returning *",
      [rating, comment, productid, req.user.id],
    );
  }
  const allReviews = await database.query(
    `select avg(rating) as avg_rating from reviews where product_id = $1`,
    [productid],
  );
  const newAvgRating = allReviews.rows[0].avg_rating;
  const updateProductRating = await database.query(
    "update products set ratings = $1 where id = $2 returning *",
    [newAvgRating, productid],
  );
  return res.status(200).json({
    success: true,
    review: reviews.rows[0],
    message: "Review posted successfully",
    product: updateProductRating.rows[0],
  });
});
//delete review
module.exports.deleteProductReview = catchAsyncError(async (req, res, next) => {
  const { productid } = req.params;
  const review = await database.query(
    `delete from reviews where product_id=$1 and user_id=$2 returning *`,
    [productid, req.user.id],
  );
  if (review.rows.length === 0) {
    return next(new ErrorHandler("Review not found", 404));
  }
  const allReviews = await database.query(
    `select avg(rating) as avg_rating from reviews where product_id = $1`,
    [productid],
  );
  const newAvgRating = allReviews.rows[0].avg_rating || 0;
  const updateProductRating = await database.query(
    "update products set ratings = $1 where id = $2 returning *",
    [newAvgRating, productid],
  );
  return res.status(200).json({
    success: true,
    message: "Review deleted successfully",
    review: review.rows[0],
    product: updateProductRating.rows[0],
  });
});
//filter products by AI
module.exports.fetchAIFilteredProducts = catchAsyncError(
  async (req, res, next) => {
    const { userPrompt } = req.body;

    if (!userPrompt || !userPrompt.trim()) {
      return next(new ErrorHandler("Provide a valid prompt.", 400));
    }

    const filterKeywords = (query) => {
      const stopWords = new Set([
        "là",
        "của",
        "và",
        "hay",
        "hoặc",
        "cho",
        "với",
        "một",
        "những",
        "các",
        "được",
        "bị",
        "tôi",
        "mình",
        "em",
        "anh",
        "chị",
        "muốn",
        "cần",
        "tìm",
        "mua",
        "giúp",
        "hãy",
        "vui",
        "lòng",
        "có",
        "không",
        "ở",
        "trong",
        "ngoài",
        "trên",
        "dưới",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "0",
      ]);

      return query
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((word) => word && !stopWords.has(word))
        .map((word) => `%${word}%`);
    };

    const keywords = filterKeywords(userPrompt);

    if (keywords.length === 0) {
      return next(
        new ErrorHandler("Please enter more specific keywords.", 400),
      );
    }

    const result = await database.query(
      `
      SELECT 
        id,
        name,
        description,
        category,
        price,
        ratings,
        stock,
        images,
        created_at
      FROM products
      WHERE 
        name ILIKE ANY($1)
        OR description ILIKE ANY($1)
        OR category ILIKE ANY($1)
      ORDER BY created_at DESC
      LIMIT 100;
      `,
      [keywords],
    );

    const filteredProducts = result.rows;

    if (filteredProducts.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No products found matching your prompt.",
        products: [],
      });
    }

    const aiProducts = await getAIRecommendation(userPrompt, filteredProducts);

    return res.status(200).json({
      success: true,
      message: "AI filtered products.",
      total: aiProducts.length,
      products: aiProducts,
    });
  },
);
