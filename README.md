# SYRAVEN

Syraven, yapay zekâ destekli, workspace tabanlı, ölçeklenebilir ve kurumsal kullanıma uygun yeni nesil bir dijital çalışma platformudur.

Platform; kullanıcıların, ekiplerin ve organizasyonların projelerini, görevlerini, bilgilerini, dosyalarını, konuşmalarını, aramalarını ve yapay zekâ destekli süreçlerini merkezi bir sistem üzerinden yönetmesini hedefler.

---

# İçindekiler

- Proje Hakkında
- Temel Özellikler
- Mimari
- Teknoloji Yığını
- Proje Yapısı
- Başlangıç
- Ortam Değişkenleri
- Geliştirme Komutları
- Kodlama Standartları
- Güvenlik
- Workspace Mimarisi
- Servis Katmanı
- API Mimarisi
- Görev Sistemi
- Bilgi Sistemi
- Dosya Sistemi
- Yapay Zekâ Entegrasyonları
- Supabase Kullanımı
- Test ve Doğrulama
- Production Hazırlığı
- Katkı Kuralları
- Lisans

---

# Proje Hakkında

Syraven, modern ekiplerin ve organizasyonların dijital operasyonlarını tek bir platform içerisinde yönetebilmesi için tasarlanan kapsamlı bir yazılım altyapısıdır.

Platformun temel amacı:

- Kullanıcı yönetimi
- Workspace yönetimi
- Proje yönetimi
- Görev yönetimi
- Dosya yönetimi
- Bilgi yönetimi
- Mesajlaşma
- Bildirim sistemi
- Gelişmiş arama
- Kullanım analitiği
- Yapay zekâ entegrasyonları
- Ses işleme
- Görsel işleme
- Güvenli API altyapısı
- Arka plan görevleri

gibi sistemleri ortak ve ölçeklenebilir bir mimari altında birleştirmektir.

Syraven, küçük bir uygulama olarak değil, uzun vadede büyüyebilecek bir platform altyapısı olarak tasarlanmıştır.

---

# Temel Özellikler

## Workspace Tabanlı Mimari

Syraven çoklu workspace mimarisini destekler.

Her kullanıcı bir veya birden fazla workspace içerisinde bulunabilir.

Workspace yapısı:

```text
Organization
      │
      ├── Workspace A
      │      ├── Members
      │      ├── Projects
      │      ├── Tasks
      │      ├── Knowledge
      │      └── Files
      │
      └── Workspace B
             ├── Members
             ├── Projects
             ├── Tasks
             ├── Knowledge
             └── Files