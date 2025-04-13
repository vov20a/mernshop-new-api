const User = require('../models/User');
// const Note = require('../models/Note')
const bcrypt = require('bcrypt');
const cloudinary = require('cloudinary');

// @desc Get all users
// @route GET /users
// @access Private
const getAllUsers = async (req, res) => {
  // Get all users from MongoDB
  const users = await User.find().select('-password').lean();

  // If no users
  if (!users?.length) {
    return res.status(400).json({ message: 'No users found' });
  }

  res.json(users);
};

// @desc Create new user
// @route POST /users
// @access Private
const createNewUser = async (req, res) => {
  const { username, email, password, roles, avatar } = req.body;

  // Confirm data
  if (!username || !email || !password || !avatar) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Check for duplicate username
  const duplicate = await User.findOne({ username })
    .collation({ locale: 'en', strength: 2 })
    .lean()
    .exec();

  if (duplicate) {
    return res.status(409).json({ message: 'Duplicate username' });
  }
  // Check for duplicate email
  const duplicateEmail = await User.findOne({ email }).lean().exec();

  if (duplicateEmail) {
    return res.status(409).json({ message: 'Duplicate email' });
  }

  myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
    folder: 'avatars',
    width: 150,
    crop: 'scale',
  });

  // Hash password
  const hashedPwd = await bcrypt.hash(password, 10); // salt rounds

  const userObject =
    !Array.isArray(roles) || !roles.length
      ? {
          username,
          email,
          password: hashedPwd,
          avatar: {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          },
        }
      : {
          username,
          email,
          password: hashedPwd,
          roles,
          avatar: {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          },
        };

  // Create and store new user
  const user = await User.create(userObject);

  if (user) {
    //created
    res.status(201).json({ message: `New user ${username} with ${email} created` });
  } else {
    res.status(400).json({ message: 'Invalid user data received' });
  }
};

// @desc Update a user
// @route PATCH /users
// @access Private
const updateUser = async (req, res) => {
  const { id, username, email, roles, password, avatar } = req.body;

  // Confirm data
  if (!id || !username || !email || !avatar || !Array.isArray(roles) || !roles.length) {
    return res.status(400).json({ message: 'All fields except password are required' });
  }

  // Does the user exist to update?
  const user = await User.findById(id).exec();

  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  // Check for duplicate username
  const duplicate = await User.findOne({ username })
    .collation({ locale: 'en', strength: 2 })
    .lean()
    .exec();

  // Check for duplicate email
  const duplicateEmail = await User.findOne({ email }).lean().exec();

  // Allow updates to the original user
  if (
    (duplicate && duplicate?._id.toString() !== id) ||
    (duplicateEmail && duplicateEmail?._id.toString() !== id)
  ) {
    return res.status(409).json({ message: 'Duplicate username or email' });
  }

  // Avatar Start Here
  let newAvatar = '';

  if (typeof req.body.avatar === 'string') {
    newAvatar = req.body.avatar;
  }

  let avatarLink = {};
  if (newAvatar !== undefined) {
    // Deleting Images From Cloudinary

    await cloudinary.v2.uploader.destroy(user.avatar.public_id);

    const result = await cloudinary.v2.uploader.upload(newAvatar, {
      folder: 'avatars',
    });

    avatarLink = {
      public_id: result.public_id,
      url: result.secure_url,
    };

    req.body.avatar = avatarLink;
  }

  user.username = username;
  user.email = email;
  user.roles = roles;
  user.avatar = req.body.avatar;

  if (password) {
    // Hash password
    user.password = await bcrypt.hash(password, 10); // salt rounds
  }

  const updatedUser = await user.save();

  res.json({ message: `${updatedUser.username} with ${updatedUser.email}  updated` });
};

// @desc Delete a user
// @route DELETE /users
// @access Private
const deleteUser = async (req, res) => {
  const { id } = req.body;

  // Confirm data
  if (!id) {
    return res.status(400).json({ message: 'User ID Required' });
  }

  // Does the user still have assigned notes?
  //   const note = await Note.findOne({ user: id }).lean().exec();
  //   if (note) {
  //     return res.status(400).json({ message: 'User has assigned notes' });
  //   }

  // Does the user exist to delete?
  const user = await User.findById(id).exec();

  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  //delete images from cloudinary
  await cloudinary.v2.uploader.destroy(user.avatar.public_id);

  const result = await user.deleteOne();

  const reply = `Username ${result.username} with ID ${result._id} deleted`;

  res.json(reply);
};

module.exports = {
  getAllUsers,
  createNewUser,
  updateUser,
  deleteUser,
};
