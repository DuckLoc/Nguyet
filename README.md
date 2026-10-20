# Món quà 20/10 dành cho Ánh Nguyệt

Website quà tặng 20/10 dành riêng cho Ánh Nguyệt, được xây dựng bằng React, TypeScript, Vite, Tailwind CSS v4, Motion và Lucide React. Trang mở đầu theo phong cách giới thiệu bộ sưu tập, có thư, dòng thời gian, album ảnh/video, lời nhắn bí mật và phần kết.

## Chỉnh sửa nội dung

Mở [`src/content.ts`](./src/content.ts) để sửa tên người nhận, lời chúc, thư, các lời nhắn, đường dẫn media và chú thích ảnh/video. Nội dung mặc định không nêu tên người gửi hay khẳng định kỷ niệm có thật. Nếu muốn ký tên hoặc thêm chú thích cụ thể, hãy tự cập nhật cấu hình.

## Media có sẵn trong website

Ảnh và video được đóng gói trong [`public/media/anh-nguyet/`](./public/media/anh-nguyet/) và hiển thị ngay khi mở website, không cần người dùng tải chúng lên. Ảnh nguồn HEIF đã được chuyển sang JPEG và thu nhỏ để tương thích trình duyệt, video MP4 được giữ nguyên. Để thay ảnh, đặt tệp mới trong thư mục đó rồi cập nhật `coverImage` hoặc danh sách `media` trong `src/content.ts`.

Người truy cập website có thể xem (và có thể tải) những tệp media được đóng gói/triển khai cùng website. Chỉ thêm ảnh/video khi bạn có quyền chia sẻ chúng với người xem website.

## Thêm ảnh riêng trên trình duyệt

Nút **Thêm ảnh riêng** vẫn cho phép chọn nhiều ảnh; chúng hiện trong album, có thể thêm chú thích, mở lightbox hoặc xóa. Ảnh và chú thích bổ sung được lưu bằng IndexedDB trong trình duyệt trên thiết bị hiện tại. Chúng **không** được gửi lên máy chủ hoặc đồng bộ sang thiết bị khác. Phần này tách biệt với ảnh/video đã có sẵn trong mã nguồn.

## Chạy trên máy

Cần cài Node.js và npm. Tại thư mục dự án:

```sh
npm install
npm run dev
```

Mở địa chỉ local mà Vite in ra trong terminal.

## Kiểm tra và build

```sh
npm run lint
npm run build
npm run preview
```

`npm run build` tạo website tĩnh trong thư mục `dist/`. `npm run preview` xem thử bản build trên máy.

## Triển khai

Chạy `npm run build`, sau đó triển khai nội dung thư mục `dist/` lên dịch vụ hosting website tĩnh (ví dụ GitHub Pages, Netlify hoặc Cloudflare Pages). Chọn lệnh build `npm run build` và thư mục đầu ra `dist`. Các tệp media trong `public/media/` sẽ được chép vào bản build. Website không cần backend; ảnh/video có sẵn sẽ được phục vụ như tài nguyên tĩnh công khai, còn ảnh bổ sung qua **Thêm ảnh riêng** chỉ nằm trong trình duyệt của từng thiết bị.
