#!/usr/bin/env python3
"""Erzeugt ein AmigaDOS-OFS-ADF-Image (880 KB, DD) mit einer Datei.

Layout laut adflib (adf_blk.h) / AmigaDOS-OFS-Spezifikation:
  Bloecke 0-1:   Bootblock ("DOS\\0", Checksum, Rootblock=880)
  Block 880:     Rootblock (type 2, ht_size 72, Hash-Tabelle ab +24, ...)
  Block 881:     Bitmap (Checksum +0, Map[127] ab +4; Bit = Block-2)
  Block 882:     File-Header (type 2, sec_type -3)
  Block 883..:   OFS-Datenbloecke (type 8, 488 Byte Nutzdaten ab +24)

Block-Checksumme: Summe aller 128 Longwords des Blocks (inkl. Checksumme) = 0.
Bootblock-Checksumme: End-around-carry-Summe, dann invertiert (~sum).
"""
import struct
import sys
import datetime

BS = 512
NBLOCKS = 1760
ROOT = 880
DISK_NAME = "WOHNUNGSPLANER"
FILE_NAME = "WOHNUNGSPLANER.BAS"


def be32(v):
    return struct.pack(">I", v & 0xFFFFFFFF)


def block_checksum_set(block, off):
    struct.pack_into(">I", block, off, 0)
    s = 0
    for i in range(0, BS, 4):
        s = (s + struct.unpack_from(">I", block, i)[0]) & 0xFFFFFFFF
    struct.pack_into(">I", block, off, (-s) & 0xFFFFFFFF)


def boot_checksum(bb):
    struct.pack_into(">I", bb, 4, 0)
    s = 0
    for i in range(0, 1024, 4):
        d = struct.unpack_from(">I", bb, i)[0]
        s += d
        if s > 0xFFFFFFFF:
            s = (s & 0xFFFFFFFF) + 1
    return (~s) & 0xFFFFFFFF


def adf_hash(name):
    h = 0
    for ch in name.upper():
        h = (h * 13 + ord(ch)) % 72
    return h


def amiga_date():
    now = datetime.datetime.now()
    days = (now.date() - datetime.date(1978, 1, 1)).days
    mins = now.hour * 60 + now.minute
    ticks = now.second * 50
    return days, mins, ticks


def build_adf(src_path, out_path):
    data = open(src_path, "rb").read()
    ndata = (len(data) + 487) // 488
    first_data = 883
    header_blk = 882
    bitmap_blk = 881
    used = set([ROOT, bitmap_blk, header_blk] + list(range(first_data, first_data + ndata)))

    img = bytearray(NBLOCKS * BS)

    bb = bytearray(1024)
    bb[0:4] = b"DOS\x00"
    struct.pack_into(">I", bb, 8, ROOT)
    struct.pack_into(">I", bb, 4, boot_checksum(bb))
    img[0:1024] = bb

    root = bytearray(BS)
    struct.pack_into(">I", root, 0x000, 2)          # type T_HEADER
    struct.pack_into(">I", root, 0x004, 0)          # headerKey (root: 0)
    struct.pack_into(">I", root, 0x008, 0)          # highSeq
    struct.pack_into(">I", root, 0x00C, 72)         # ht_size
    struct.pack_into(">I", root, 0x010, 0)          # firstData
    # checksum at 0x014, computed later
    struct.pack_into(">I", root, 0x018 + 4 * adf_hash(FILE_NAME), header_blk)
    struct.pack_into(">I", root, 0x138, 0xFFFFFFFF)  # bmFlag = valid
    struct.pack_into(">I", root, 0x13C, bitmap_blk)  # bmPages[0]
    struct.pack_into(">I", root, 0x1A0, 0)          # bmExt
    d, m, t = amiga_date()
    struct.pack_into(">III", root, 0x1A4, d, m, t)   # creation (FFS slot)
    root[0x1B0] = len(DISK_NAME)
    root[0x1B1:0x1B1 + len(DISK_NAME)] = DISK_NAME.encode("ascii")
    struct.pack_into(">III", root, 0x1D8, d, m, t)   # last access
    struct.pack_into(">III", root, 0x1E4, d, m, t)   # creation (OFS)
    struct.pack_into(">I", root, 0x1F0, 0)          # nextSameHash
    struct.pack_into(">I", root, 0x1F4, 0)          # parent
    struct.pack_into(">I", root, 0x1F8, 0)          # extension
    struct.pack_into(">I", root, 0x1FC, 1)          # secType ST_ROOT
    block_checksum_set(root, 0x014)
    img[ROOT * BS:(ROOT + 1) * BS] = root

    bm = bytearray(BS)
    for i in range(4, BS, 4):
        struct.pack_into(">I", bm, i, 0xFFFFFFFF)
    for b in used:
        bit = b - 2  # blocks 0,1 (boot) sind reserviert und nicht in der Bitmap
        off = 4 + 4 * (bit // 32)
        struct.pack_into(">I", bm, off, struct.unpack_from(">I", bm, off)[0] & ~(1 << (bit % 32)) & 0xFFFFFFFF)
    block_checksum_set(bm, 0)
    img[bitmap_blk * BS:(bitmap_blk + 1) * BS] = bm

    fh = bytearray(BS)
    struct.pack_into(">I", fh, 0x000, 2)            # type T_HEADER
    struct.pack_into(">I", fh, 0x004, header_blk)   # headerKey = self
    struct.pack_into(">I", fh, 0x008, ndata)        # highSeq
    struct.pack_into(">I", fh, 0x00C, 0)            # dataSize (==0)
    struct.pack_into(">I", fh, 0x010, first_data)   # firstData
    for i in range(ndata):
        struct.pack_into(">I", fh, 0x018 + 4 * (71 - i), first_data + i)
    struct.pack_into(">I", fh, 0x140, 0)            # access/protect
    struct.pack_into(">I", fh, 0x144, len(data))    # byteSize
    fh[0x148] = 0                                    # commLen
    struct.pack_into(">III", fh, 0x1A4, d, m, t)    # date
    fh[0x1B0] = len(FILE_NAME)
    fh[0x1B1:0x1B1 + len(FILE_NAME)] = FILE_NAME.encode("ascii")
    struct.pack_into(">I", fh, 0x1D4, 0)            # real
    struct.pack_into(">I", fh, 0x1D8, 0)            # nextLink
    struct.pack_into(">I", fh, 0x1F0, 0)            # nextSameHash
    struct.pack_into(">I", fh, 0x1F4, ROOT)         # parent
    struct.pack_into(">I", fh, 0x1F8, 0)            # extension
    struct.pack_into(">I", fh, 0x1FC, 0xFFFFFFFD)   # secType ST_FILE (-3)
    block_checksum_set(fh, 0x014)
    img[header_blk * BS:(header_blk + 1) * BS] = fh

    for i in range(ndata):
        chunk = data[i * 488:(i + 1) * 488]
        db = bytearray(BS)
        struct.pack_into(">I", db, 0x000, 8)        # T_DATA
        struct.pack_into(">I", db, 0x004, header_blk)
        struct.pack_into(">I", db, 0x008, i + 1)    # seqNum
        struct.pack_into(">I", db, 0x00C, len(chunk))
        struct.pack_into(">I", db, 0x010, first_data + i + 1 if i + 1 < ndata else 0)
        db[0x018:0x018 + len(chunk)] = chunk
        block_checksum_set(db, 0x014)
        blk = first_data + i
        img[blk * BS:(blk + 1) * BS] = db

    open(out_path, "wb").write(img)
    return len(img), ndata


def block_sum_zero(block):
    s = 0
    for i in range(0, BS, 4):
        s = (s + struct.unpack_from(">I", block, i)[0]) & 0xFFFFFFFF
    return s == 0


def verify_adf(adf_path, src_path):
    img = open(adf_path, "rb").read()
    src = open(src_path, "rb").read()
    assert len(img) == NBLOCKS * BS, "falsche ADF-Groesse"
    assert img[0:4] == b"DOS\x00", "kein OFS-Bootblock"
    assert struct.unpack_from(">I", img, 8)[0] == ROOT, "Rootblock-Pointer falsch"
    bb = img[0:1024]
    saved = struct.unpack_from(">I", bb, 4)[0]
    struct.pack_into(">I", bytearray(bb), 4, 0)
    assert saved == boot_checksum(bytearray(bb)), "Bootblock-Checksumme falsch"

    root = img[ROOT * BS:(ROOT + 1) * BS]
    assert struct.unpack_from(">I", root, 0)[0] == 2
    assert struct.unpack_from(">I", root, 0x00C)[0] == 72
    assert block_sum_zero(root), "Rootblock-Checksumme falsch"
    assert struct.unpack_from(">I", root, 0x138)[0] == 0xFFFFFFFF
    bm_blk = struct.unpack_from(">I", root, 0x13C)[0]
    disk_name = root[0x1B1:0x1B1 + root[0x1B0]].decode()
    assert struct.unpack_from(">I", root, 0x1FC)[0] == 1

    bm = img[bm_blk * BS:(bm_blk + 1) * BS]
    assert block_sum_zero(bm), "Bitmap-Checksumme falsch"

    bucket = adf_hash(FILE_NAME)
    fh_blk = struct.unpack_from(">I", root, 0x018 + 4 * bucket)[0]
    assert fh_blk != 0, "Datei nicht in Hash-Tabelle"
    fh = img[fh_blk * BS:(fh_blk + 1) * BS]
    assert struct.unpack_from(">I", fh, 0)[0] == 2
    assert struct.unpack_from(">I", fh, 0x004)[0] == fh_blk
    assert block_sum_zero(fh), "File-Header-Checksumme falsch"
    name = fh[0x1B1:0x1B1 + fh[0x1B0]].decode()
    assert name.upper() == FILE_NAME.upper(), "Dateiname falsch: " + name
    assert struct.unpack_from(">I", fh, 0x1F4)[0] == ROOT
    assert struct.unpack_from(">I", fh, 0x1FC)[0] == 0xFFFFFFFD
    ndata = struct.unpack_from(">I", fh, 0x008)[0]
    size = struct.unpack_from(">I", fh, 0x144)[0]
    assert size == len(src), "byteSize falsch"

    out = bytearray()
    # Datenbloecke ueber die Tabelle (rueckwaerts ab Index 71) und die Kette pruefen
    chain = struct.unpack_from(">I", fh, 0x010)[0]
    for i in range(ndata):
        blk_no = struct.unpack_from(">I", fh, 0x018 + 4 * (71 - i))[0]
        assert blk_no == first_data_check(chain, i, fh_blk, img), "Tabellen-/Ketten-Inkonsistenz"
        db = img[blk_no * BS:(blk_no + 1) * BS]
        assert struct.unpack_from(">I", db, 0)[0] == 8
        assert struct.unpack_from(">I", db, 0x004)[0] == fh_blk
        assert struct.unpack_from(">I", db, 0x008)[0] == i + 1
        assert block_sum_zero(db), "Datenblock-Checksumme falsch block %d" % blk_no
        dsz = struct.unpack_from(">I", db, 0x00C)[0]
        out += db[0x018:0x018 + dsz]
    assert bytes(out) == src, "Dateiinhalt stimmt nicht mit Quelle ueberein"

    # Bitmap: belegte Bloecke muessen als benutzt markiert sein
    for b in [ROOT, bm_blk, fh_blk] + [struct.unpack_from(">I", fh, 0x018 + 4 * (71 - i))[0] for i in range(ndata)]:
        bit = b - 2
        val = struct.unpack_from(">I", bm, 4 + 4 * (bit // 32))[0]
        assert (val >> (bit % 32)) & 1 == 0, "Block %d nicht als benutzt markiert" % b

    return {
        "size": len(img),
        "disk": disk_name,
        "file": name,
        "file_bytes": size,
        "data_blocks": ndata,
        "bucket": bucket,
        "header_block": fh_blk,
    }


def first_data_check(chain, i, fh_blk, img):
    # folgt der nextData-Kette
    blk = chain
    for _ in range(i):
        blk = struct.unpack_from(">I", img, blk * BS + 0x010)[0]
    return blk


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "Wohnungsplaner.bas"
    out = sys.argv[2] if len(sys.argv) > 2 else "Wohnungsplaner.adf"

    # Hash-Variante gegen bekanntes Kollisionsbeispiel pruefen (Wikipedia OFS-Artikel)
    coll = {adf_hash(n) for n in ["file_1a", "file_24", "file_5u"]}
    assert len(coll) == 1, "Hash-Funktion liefert keine Kollision fuer file_1a/file_24/file_5u"

    size, ndata = build_adf(src, out)
    info = verify_adf(out, src)
    print("ADF gebaut: %s (%d Bytes, %d Datenbloecke)" % (out, size, ndata))
    print("Verifiziert: Disk '%s', Datei '%s' (%d Bytes), Bucket %d, Header-Block %d"
          % (info["disk"], info["file"], info["file_bytes"], info["bucket"], info["header_block"]))
    print("Alle Checksummen OK, Datei-Inhalt byte-identisch zur Quelle.")


if __name__ == "__main__":
    main()
