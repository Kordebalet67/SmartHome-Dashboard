import os, glob, random, colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import torch, torch.nn as nn
from torch.utils.data import Dataset, DataLoader, ConcatDataset

H, W, BLANK = 64, 192, 10

def preprocess(pil, sat_thr=60):
    """Убирает бледный шум по насыщенности, кропает по контенту, нормализует размер."""
    a = np.asarray(pil.convert("RGB"), dtype=np.int16)
    sat = 255 - a.min(2)                      # "удалённость от белого"
    g = np.clip((sat - sat_thr) * (255 / (255 - sat_thr)), 0, 255).astype(np.uint8)
    ys, xs = np.where(g > 25)
    if len(xs) < 20:                          # fallback, если порог слишком высокий
        g = np.clip(sat * 3, 0, 255).astype(np.uint8)
        ys, xs = np.where(g > 25)
        if len(xs) < 20: return np.zeros((H, W), np.uint8)
    g = g[ys.min():ys.max()+1, xs.min():xs.max()+1]
    h, w = g.shape
    s = min((H-8)/h, (W-8)/w)
    nh, nw = max(1, int(h*s)), max(1, int(w*s))
    g = np.asarray(Image.fromarray(g).resize((nw, nh), Image.BILINEAR))
    out = np.zeros((H, W), np.uint8)
    y0, x0 = (H-nh)//2, (W-nw)//2
    out[y0:y0+nh, x0:x0+nw] = g
    return out                                # белые штрихи на чёрном, 64x192

class CaptchaGenerator:
    def __init__(self, font_dir="fonts", size=(300, 180), length=4, seed=None):
        self.fonts = sorted(glob.glob(os.path.join(font_dir, "*.ttf")))
        assert self.fonts, "Положи .ttf шрифты в ./fonts"
        self.w, self.h, self.length = size[0], size[1], length
        self.rnd = random.Random(seed)
        self._cache = {}

    def _font(self, path, sz):
        k = (path, sz)
        if k not in self._cache: self._cache[k] = ImageFont.truetype(path, sz)
        return self._cache[k]

    def _layer(self, ch, sz, rgb, alpha, angle):
        r = self.rnd
        pad = sz
        layer = Image.new("RGBA", (sz*2+pad, sz*2+pad), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        pos = (pad//2, pad//2)
        d.text(pos, ch, font=self._font(r.choice(self.fonts), sz), fill=rgb+(alpha,))
        bb = d.textbbox(pos, ch, font=self._font(r.choice(self.fonts), sz))
        layer = layer.crop((bb[0]-2, bb[1]-2, bb[2]+2, bb[3]+2))
        return layer.rotate(angle, resample=Image.BICUBIC, expand=True)

    def sample(self):
        r = self.rnd
        label = "".join(r.choice("0123456789") for _ in range(self.length))
        img = Image.new("RGB", (self.w, self.h), (255, 255, 255))
        # бледный фоновый шум
        for _ in range(r.randint(10, 25)):
            rgb = tuple(int(c*255) for c in colorsys.hsv_to_rgb(r.random(), r.uniform(.3, .8), r.uniform(.8, 1)))
            l = self._layer(r.choice("0123456789"), r.randint(18, 55), rgb, r.randint(15, 50), r.uniform(-45, 45))
            img.paste(l, (r.randint(-20, self.w-10), r.randint(-20, self.h-10)), l)
        # основные цифры с пересечением
        hues = [0.62, 0.42, 0.50, 0.58, 0.35, 0.75]   # синие/зелёные/бирюзовые оттенки
        sizes = [r.randint(60, 90) for _ in label]
        xs, x = [], r.randint(30, 60)
        for sz in sizes: xs.append(x); x += int(sz * r.uniform(0.42, 0.62))
        left, right = xs[0]-sizes[0]//2, xs[-1]+sizes[-1]//2
        shift = r.randint(8, max(9, self.w-(right-left)-8)) - left
        xs = [v+shift for v in xs]
        order = list(range(self.length)); r.shuffle(order)
        for i in order:
            rgb = tuple(int(c*255) for c in colorsys.hsv_to_rgb((r.choice(hues)+r.uniform(-.04, .04)) % 1, r.uniform(.55, .85), r.uniform(.6, .9)))
            l = self._layer(label[i], sizes[i], rgb, 255, r.uniform(-12, 12))
            cy = r.randint(78, 102)
            img.paste(l, (xs[i]-l.width//2, cy-l.height//2), l)
        return img, label

class SynthDS(Dataset):
    def __init__(self, gen, n, randomize=True): self.gen, self.n, self.rand = gen, n, randomize
    def __len__(self): return self.n
    def __getitem__(self, i):
        if self.rand: self.gen.rnd.seed(int.from_bytes(os.urandom(4), "little"))  # уникальность по воркерам
        img, lab = self.gen.sample()
        x = torch.from_numpy(preprocess(img)).float().div_(255).unsqueeze(0)
        return x, torch.tensor([int(c) for c in lab])

class RealDS(Dataset):
    def __init__(self, folder):
        self.files = [p for p in glob.glob(folder+"/*")
                      if os.path.splitext(p)[1].lower() in (".png", ".jpg", ".jpeg")
                      and os.path.basename(p)[:4].isdigit()]
        assert self.files, f"Нет размеченных файлов в {folder} (имя должно начинаться с 4 цифр)"
    def __len__(self): return len(self.files)
    def __getitem__(self, i):
        p = self.files[i]
        x = torch.from_numpy(preprocess(Image.open(p))).float().div_(255).unsqueeze(0)
        return x, torch.tensor([int(c) for c in os.path.basename(p)[:4]])

def collate(b):
    xs, ys = zip(*b)
    return torch.stack(xs), torch.cat(ys), torch.tensor([len(y) for y in ys])

class CRNN(nn.Module):
    def __init__(self, hidden=256):
        super().__init__()
        def blk(i, o, pool): return nn.Sequential(
            nn.Conv2d(i, o, 3, padding=1), nn.BatchNorm2d(o), nn.ReLU(True), nn.MaxPool2d(pool))
        self.cnn = nn.Sequential(blk(1,32,2), blk(32,64,2), blk(64,128,2),
                                 blk(128,256,(2,1)), blk(256,256,(2,1)))   # -> 256 x 2 x 24
        self.pool = nn.AdaptiveAvgPool2d((1, None))
        self.rnn = nn.LSTM(256, hidden, 2, bidirectional=True, batch_first=True, dropout=0.1)
        self.fc = nn.Linear(hidden*2, 11)                                  # 10 цифр + blank
    def forward(self, x):
        f = self.pool(self.cnn(x)).squeeze(2).permute(0, 2, 1)             # B, T=24, C
        return self.fc(self.rnn(f)[0])

@torch.no_grad()
def decode(logits):
    probs = logits.softmax(-1)
    ids = probs.argmax(-1)
    out = []
    for b in range(ids.size(0)):
        prev, chars, confs = BLANK, [], []
        for t in range(ids.size(1)):
            i = int(ids[b, t])
            if i != prev and i != BLANK:
                chars.append(str(i)); confs.append(float(probs[b, t, i]))
            prev = i
        out.append(("".join(chars), min(confs) if confs else 0.0))
    return out

from tqdm import tqdm

@torch.no_grad()
def evaluate(model, loader, device):
    model.eval(); ok = n = 0
    for x, tgt, tl in loader:
        preds = decode(model(x.to(device)))
        off = 0
        for i, l in enumerate(tl.tolist()):
            lab = "".join(map(str, tgt[off:off+l].tolist())); off += l
            ok += preds[i][0] == lab; n += 1
    return ok / max(n, 1)

def fit(model, train_loader, val_loader, epochs, max_lr, out, device="cuda"):
    opt = torch.optim.AdamW(model.parameters(), max_lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr, total_steps=epochs*len(train_loader), pct_start=0.08)
    scaler = torch.amp.GradScaler("cuda")
    ctc = nn.CTCLoss(blank=BLANK, zero_infinity=True)
    best = 0.0
    for ep in range(epochs):
        model.train()
        for x, tgt, tl in tqdm(train_loader, desc=f"epoch {ep+1}/{epochs}"):
            x, tgt, tl = x.to(device, non_blocking=True), tgt.to(device), tl.to(device)
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda"):
                logits = model(x)
                loss = ctc(logits.log_softmax(2).permute(1, 0, 2), tgt,
                           torch.full((x.size(0),), logits.size(1), dtype=torch.long, device=device), tl)
            scaler.scale(loss).backward()
            scaler.unscale_(opt); nn.utils.clip_grad_norm_(model.parameters(), 5)
            scaler.step(opt); scaler.update(); sched.step()
        acc = evaluate(model, val_loader, device)
        print(f"epoch {ep+1}: exact-match = {acc:.4f}")
        if acc > best:
            best = acc; torch.save(model.state_dict(), out); print(f"  saved {out}")
    return best

def cmd_synth():
    train_loader = DataLoader(SynthDS(CaptchaGenerator(), 120_000), batch_size=256, shuffle=True,
                              num_workers=8, pin_memory=True, persistent_workers=True, collate_fn=collate, drop_last=True)
    val_loader = DataLoader(SynthDS(CaptchaGenerator(seed=1234), 3000, randomize=False),
                            batch_size=256, num_workers=0, collate_fn=collate)
    fit(CRNN().cuda(), train_loader, val_loader, epochs=35, max_lr=1e-3, out="captcha_synth.pt")

def cmd_finetune():
    model = CRNN().cuda(); model.load_state_dict(torch.load("captcha_synth.pt"))
    real = RealDS("real")
    ds = ConcatDataset([real]*6 + [SynthDS(CaptchaGenerator(), 20_000)])   # реал оверсемплим, синтетика против переобучения
    train_loader = DataLoader(ds, batch_size=256, shuffle=True, num_workers=8,
                              pin_memory=True, persistent_workers=True, collate_fn=collate, drop_last=True)
    val_loader = DataLoader(RealDS("real_val"), batch_size=256, num_workers=0, collate_fn=collate)
    fit(model, train_loader, val_loader, epochs=12, max_lr=1e-4, out="captcha_best.pt")

@torch.no_grad()
def predict(path, model, device="cuda"):
    x = torch.from_numpy(preprocess(Image.open(path))).float().div_(255)[None, None].to(device)
    return decode(model(x))[0]                      # (текст, уверенность)

def cmd_pseudo(thr=0.985):
    """TTA по порогу насыщенности: метка принимается, только если все варианты согласны."""
    model = CRNN().cuda(); model.load_state_dict(torch.load("captcha_best.pt")); model.eval()
    added = 0
    for p in glob.glob("unlabeled/*"):
        if os.path.splitext(p)[1].lower() not in (".png", ".jpg", ".jpeg"): continue
        img = Image.open(p)
        votes = []
        for t in (50, 65, 80):
            x = torch.from_numpy(preprocess(img, sat_thr=t)).float().div_(255)[None, None].cuda()
            votes.append(decode(model(x))[0])
        texts = {v[0] for v in votes}
        if len(texts) == 1 and len(votes[0][0]) == 4 and min(v[1] for v in votes) >= thr:
            import shutil; shutil.copy(p, f"real/{votes[0][0]}_{os.path.basename(p)}"); added += 1
    print(f"Добавлено псевдометок: {added}")

def cmd_onnx():
    model = CRNN().cpu().eval(); model.load_state_dict(torch.load("captcha_best.pt", map_location="cpu"))
    torch.onnx.export(model, torch.randn(1, 1, H, W), "captcha.onnx", opset=17,
                      input_names=["x"], output_names=["logits"],
                      dynamic_axes={"x": {0: "b"}, "logits": {0: "b"}})

if __name__ == "__main__":
    import sys
    cmd = sys.argv[1] if len(sys.argv) > 1 else "synth"
    if cmd == "synth": cmd_synth()
    elif cmd == "finetune": cmd_finetune()
    elif cmd == "pseudo": cmd_pseudo()
    elif cmd == "onnx": cmd_onnx()
    elif cmd == "predict":
        m = CRNN().cuda(); m.load_state_dict(torch.load("captcha_best.pt")); m.eval()
        print(predict(sys.argv[2], m))