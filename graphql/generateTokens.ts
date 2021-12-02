import { Environments } from '@lagunahealth/pandora';
import * as jwt from 'jsonwebtoken';
import { Model, connect, disconnect, model } from 'mongoose';
import { v4 } from 'uuid';
import { Member, MemberDto } from '../src/member';
import { ConfigsService } from '../src/providers';
import { User, UserDto } from '../src/user';

async function main() {
  const { uri } = await new ConfigsService().createMongooseOptions();
  await connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  });
  const memberModel: Model<typeof MemberDto> = model(Member.name, MemberDto);
  const userModel: Model<typeof UserDto> = model(User.name, UserDto);

  /**
   * In here we are generating authId for members if they dont have it.
   * It's possible for member to not have authId (if web member), but
   * we want to add the authId so we can do queries for that members.
   * This is done only for local environments.
   */
  if (!process.env.NODE_ENV || process.env.NODE_ENV === Environments.test) {
    const members = await memberModel.find({ authId: null });
    members.map(async (member) => {
      await memberModel.findOneAndUpdate(
        { _id: member._id },
        {
          $set: {
            authId: v4(),
          },
        },
      );
    });
  }

  const members = await memberModel.find();
  const mappedMembers = members.map((member: any) => {
    return {
      id: member._id,
      authId: member.authId,
      token: jwt.sign({ sub: member.authId }, 'key-123'),
    };
  });
  console.log(
    '\x1b[44m%s\x1b[0m',
    '\n----------------------------------------------------------------\n' +
      '---------------------------- MEMBERS ---------------------------\n' +
      '----------------------------------------------------------------',
  );
  console.log(mappedMembers);

  const users = await userModel.find();
  const mappedUsers = users.map((user: any) => {
    return {
      id: user._id,
      authId: user.authId,
      token: jwt.sign({ sub: user.authId }, 'key-123'),
    };
  });
  console.log(
    '\x1b[44m%s\x1b[0m',
    '\n----------------------------------------------------------------\n' +
      '----------------------------- USERS ----------------------------\n' +
      '----------------------------------------------------------------',
  );
  console.log(mappedUsers);

  await disconnect();
}

(async () => {
  await main();
})();
