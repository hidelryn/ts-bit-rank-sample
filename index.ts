import Redis from "ioredis";

const redis = new Redis({
  password: "",
});

type ScoreInfo = {
  score: number;
  memberCount: number;
  clearDt: number;
};

type User = {
  member: string;
};

type UserScoreInfo = User & ScoreInfo;

const MAX_MEMBER_COUNT = 250;
const MAX_32BIT_INT = Math.pow(2, 31) - 1;
const RANK_KEY = "RankKey";

class Ranking {
  async SaveScore(scoreInfo: ScoreInfo, member: string) {
    try {
      let score = this.makeScore(scoreInfo);
      await redis.zadd(RANK_KEY, score, member); // redis에 저장 시 지수표기법으로 저장된다..
    } catch (err) {
      throw err;
    }
  }

  async GetRankList(): Promise<UserScoreInfo[]> {
    try {
      let userScoreInfoList: UserScoreInfo[] = [];
      let scoreList = await redis.zrevrange(RANK_KEY, 0, -1, "WITHSCORES");
      console.log("scoreList", scoreList);
      for (let i = 0; i < scoreList.length; i += 2) {
        let user = scoreList[i];
        let { score, memberCount, clearDt } = this.readScore(scoreList[i + 1]);
        let obj: UserScoreInfo = { member: user, score, memberCount, clearDt };
        userScoreInfoList.push(obj);
      }
      return userScoreInfoList;
    } catch (err) {
      throw err;
    }
  }

  private makeScore(scoreInfo: ScoreInfo) {
    const buf = Buffer.allocUnsafe(8);
    buf.writeIntBE(scoreInfo.score, 0, 2); // 16비트, -32,768부터 32,767까지
    buf.writeIntBE(MAX_MEMBER_COUNT - scoreInfo.memberCount, 2, 2); // 16비트, -32,768부터 32,767까지
    buf.writeIntBE(MAX_32BIT_INT - scoreInfo.clearDt, 4, 4); // 32비트 -2,147,483,648부터 2,147,483,647까지
    return buf.readBigInt64BE(0).toString();
  }

  private readScore(saveScore: string) {
    const parsedNumber = parseFloat(saveScore); // js 특성상 지수표기법 -> 실수로 변환할때 손실이 날수밖에 업음..
    const bigintNumber = BigInt(parsedNumber);

    const buf = Buffer.allocUnsafe(8);
    buf.writeBigInt64BE(bigintNumber, 0);
    let score = buf.readIntBE(0, 2);
    let memberCount = buf.readIntBE(2, 2);
    let clearDt = buf.readIntBE(4, 4);
    return {
      score,
      memberCount: MAX_MEMBER_COUNT - memberCount,
      clearDt: MAX_32BIT_INT - clearDt,
    };
  }
}

let params: ScoreInfo = {
  score: 23346,
  memberCount: 230,
  clearDt: Math.floor(Date.now() / 1000),
};

console.log("params", params);

async function main() {
  let rank = new Ranking();
  await rank.SaveScore(params, "a");
  let list = await rank.GetRankList();
  console.log("list", list);
}

main();
