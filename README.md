# HTML5 Oyun (Basit)

Basit bir ASP.NET Core + HTML5 mini oyun koleksiyonu.

## İçerik
- `Renk Sırası`: kısa bir puzzle oyunu
- `Altın Toplayıcı`: arcade tarzı refleks oyunu
- `Hafıza Kartları`: eşleştirme oyunu
- `Platform`: zıplama ve yıldız toplama
- `Endless Runner`: engellerden kaçma oyunu
- `Balon Patlatma`: tıklamalı hız oyunu
- `Space Shooter`: uzay aksiyon oyunu
- `Kelime / Bilgi`: çoktan seçmeli quiz
- `Clicker`: puan toplama oyunu
- `Savunma`: kule yerleştirme mini strateji
- C# ile çalışan basit skor API'si

## Çalıştırma
1. .NET 8 SDK kurulu olsun.
2. Proje klasöründe `dotnet run` çalıştırın.
3. Tarayıcıda açılan adresi kullanın.

## API
- `GET /api/health`
- `GET /api/scores`
- `POST /api/scores`

## Not
Bu sürümde tüm oyunlar source olarak `wwwroot/app.js` içinde tutulur ve sunucu statik dosya olarak servis eder.
