#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>

#include "../astc/compress_texture.h"
#include "../astc/constants.h"
#include "../image/bgra.h"
#include "../image/compressed.h"

static int MAGIC_FILE_CONSTANT = 0x5CA1AB13;

struct ASTCHeader {
  uint8_t magic[4];
  uint8_t blockdim_x;
  uint8_t blockdim_y;
  uint8_t blockdim_z;
  uint8_t xsize[3];
  uint8_t ysize[3];
  uint8_t zsize[3];
};


extern "C" {
  int toASTC(uint8_t* buffer, long buffer_size, long width, long height, bool alpha) {
    try {
      if (width % BLOCK_WIDTH != 0 || height % BLOCK_HEIGHT != 0) {
        fprintf(stderr,
                "Error: image size (%ldx%ld) not a multiple of block size "
                "(%ldx%ld)\n",
                width, height, BLOCK_WIDTH, BLOCK_HEIGHT);
        return 1;
      }

      CompressedImage compressed(width, height, BLOCK_WIDTH,
                                BLOCK_HEIGHT, BLOCK_BYTES);

      compress_texture(buffer, compressed.buffer,
        static_cast<int>(width),
        static_cast<int>(height), alpha);

      // write back to buffer
      /*ASTCHeader hdr;
      hdr.magic[0] = static_cast<uint8_t>(MAGIC_FILE_CONSTANT & 0xFF);
      hdr.magic[1] = static_cast<uint8_t>((MAGIC_FILE_CONSTANT >> 8) & 0xFF);
      hdr.magic[2] = static_cast<uint8_t>((MAGIC_FILE_CONSTANT >> 16) & 0xFF);
      hdr.magic[3] = static_cast<uint8_t>((MAGIC_FILE_CONSTANT >> 24) & 0xFF);
      hdr.blockdim_x = static_cast<uint8_t>(compressed.xdim);
      hdr.blockdim_y = static_cast<uint8_t>(compressed.ydim);
      hdr.blockdim_z = 1;
      hdr.xsize[0] = compressed.xsize & 0xFF;
      hdr.xsize[1] = (compressed.xsize >> 8) & 0xFF;
      hdr.xsize[2] = (compressed.xsize >> 16) & 0xFF;
      hdr.ysize[0] = compressed.ysize & 0xFF;
      hdr.ysize[1] = (compressed.ysize >> 8) & 0xFF;
      hdr.ysize[2] = (compressed.ysize >> 16) & 0xFF;
      hdr.zsize[0] = 1 & 0xFF;
      hdr.zsize[1] = (1 >> 8) & 0xFF;
      hdr.zsize[2] = (1 >> 16) & 0xFF;

      std::memcpy(buffer, &hdr, sizeof(ASTCHeader));
      std::memcpy(buffer + sizeof(ASTCHeader), compressed.buffer, compressed.buffer_size);*/
      std::memcpy(buffer, compressed.buffer, compressed.buffer_size);
      return compressed.buffer_size + sizeof(ASTCHeader);
    } catch (const char* err) {
      fprintf(stderr, "Error: %s\n", err);
      return -1;
    }
  }
}

int main(void) {
  return 1;
}
